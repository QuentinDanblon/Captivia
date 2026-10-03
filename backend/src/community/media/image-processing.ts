import { HttpStatus } from '@nestjs/common';
import sharpModule = require('sharp');
import {
  CommunityErrorCode,
  MEDIA_MAX_ASPECT_RATIO,
  MEDIA_MAX_HEIGHT,
  MEDIA_MAX_INPUT_DIMENSION,
  MEDIA_MAX_INPUT_PIXELS,
  MEDIA_MAX_WIDTH,
  MEDIA_PROCESSING_CONCURRENCY,
  MEDIA_PROCESSING_MAX_QUEUE,
  MEDIA_PROCESSING_QUEUE_TIMEOUT_MS,
  MEDIA_PROCESSING_TIMEOUT_SECONDS,
  MEDIA_WEBP_QUALITY,
} from '../community.constants';
import { withStatus } from '../community.errors';

/**
 * sharp ≥ 0.35 publie des types ESM (`export default`) mais son point d'entrée CommonJS exporte
 * directement la fonction (`module.exports = sharp`) : le projet compile en CommonJS sans
 * esModuleInterop, d'où ce typage explicite.
 */
const sharp = sharpModule as unknown as typeof sharpModule.default;

// Mémoire bornée : un seul fil libvips par image (le parallélisme est porté par le sémaphore
// ci-dessous) et aucun cache d'opérations (chaque image n'est traitée qu'une fois).
sharp.concurrency(1);
sharp.cache(false);

/** Formats d'entrée acceptés (contrôlés par leur signature binaire, jamais par le MIME annoncé). */
export type ImageKind = 'jpeg' | 'png' | 'webp';

/**
 * Type réel d'après les « magic bytes » :
 * - JPEG : FF D8 FF ;
 * - PNG : 89 50 4E 47 0D 0A 1A 0A ;
 * - WebP : « RIFF » ???? « WEBP ».
 * Tout le reste (HEIC, GIF, SVG, HTML déguisé en .png…) est refusé.
 */
export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'jpeg';
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'webp';
  return null;
}

function busy() {
  return withStatus(
    HttpStatus.SERVICE_UNAVAILABLE,
    CommunityErrorCode.MEDIA_BUSY,
    'Image processing is busy. Try again in a moment.',
  );
}

/**
 * Sémaphore de traitement : au plus `limit` tâches simultanées, `maxQueue` tâches en attente
 * (au-delà : 503 MEDIA_BUSY), attente bornée à `queueTimeoutMs` (au-delà : 503 MEDIA_BUSY).
 */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly limit: number,
    private readonly maxQueue: number,
    private readonly queueTimeoutMs: number,
  ) {}

  get running(): number {
    return this.active;
  }

  get waiting(): number {
    return this.waiters.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maxQueue) return Promise.reject(busy());
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(grant);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(busy());
      }, this.queueTimeoutMs);
      this.waiters.push(grant);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    // Le créneau passe directement à la tâche suivante (`active` ne change pas).
    if (next) next();
    else this.active--;
  }
}

/** Sémaphore global des traitements d'image du processus. */
export const imageProcessingSemaphore = new Semaphore(
  MEDIA_PROCESSING_CONCURRENCY,
  MEDIA_PROCESSING_MAX_QUEUE,
  MEDIA_PROCESSING_QUEUE_TIMEOUT_MS,
);

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  contentType: 'image/webp';
}

function invalidImage() {
  return withStatus(
    HttpStatus.BAD_REQUEST,
    CommunityErrorCode.MEDIA_INVALID_IMAGE,
    'The image could not be decoded.',
  );
}

/**
 * Contrôle des dimensions déclarées dans l'en-tête, sans décodage des pixels :
 * - largeur ou hauteur > MEDIA_MAX_INPUT_DIMENSION, ou plus de MEDIA_MAX_INPUT_PIXELS pixels :
 *   413 MEDIA_TOO_LARGE ;
 * - rapport des côtés > MEDIA_MAX_ASPECT_RATIO : 400 MEDIA_INVALID_IMAGE.
 */
export function assertSafeDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw invalidImage();
  }
  if (
    width > MEDIA_MAX_INPUT_DIMENSION ||
    height > MEDIA_MAX_INPUT_DIMENSION ||
    width * height > MEDIA_MAX_INPUT_PIXELS
  ) {
    throw withStatus(
      HttpStatus.PAYLOAD_TOO_LARGE,
      CommunityErrorCode.MEDIA_TOO_LARGE,
      `Image dimensions too large (max ${MEDIA_MAX_INPUT_DIMENSION} px per side and ${MEDIA_MAX_INPUT_PIXELS} pixels).`,
    );
  }
  if (
    Math.max(width, height) / Math.min(width, height) >
    MEDIA_MAX_ASPECT_RATIO
  ) {
    throw withStatus(
      HttpStatus.BAD_REQUEST,
      CommunityErrorCode.MEDIA_INVALID_IMAGE,
      `Image aspect ratio too extreme (max ${MEDIA_MAX_ASPECT_RATIO}:1).`,
    );
  }
}

/**
 * Chaîne de traitement d'une image téléversée, dans cet ordre :
 * 1. type réel (magic bytes) → 415 MEDIA_UNSUPPORTED_TYPE ;
 * 2. taille maximale → 413 MEDIA_TOO_LARGE ;
 * 3. créneau du sémaphore global (MEDIA_PROCESSING_CONCURRENCY traitements simultanés au plus ;
 *    file pleine ou attente trop longue → 503 MEDIA_BUSY) ;
 * 4. dimensions lues dans l'en-tête (`metadata()`, aucun décodage des pixels) : refus des images
 *    trop grandes ou trop allongées AVANT tout décodage (anti « bombe de décompression ») ;
 * 5. décodage borné (pixels, durée), orientation EXIF appliquée, redimensionnement à 1 600 px de
 *    large au plus (jamais d'agrandissement), ré-encodage WebP ;
 * 6. aucune métadonnée conservée : sharp n'écrit ni EXIF (dont GPS), ni XMP, ni IPTC tant que
 *    `keepMetadata()` / `withMetadata()` n'est pas appelé — ce module ne l'appelle jamais.
 */
export async function processImage(
  input: Buffer,
  maxBytes: number,
): Promise<ProcessedImage> {
  if (!detectImageKind(input)) {
    throw withStatus(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      CommunityErrorCode.MEDIA_UNSUPPORTED_TYPE,
      'Only JPEG, PNG and WebP images are accepted.',
    );
  }
  if (input.length > maxBytes) {
    throw withStatus(
      HttpStatus.PAYLOAD_TOO_LARGE,
      CommunityErrorCode.MEDIA_TOO_LARGE,
      `Image too large (max ${maxBytes} bytes).`,
    );
  }
  return imageProcessingSemaphore.run(() => decode(input));
}

async function decode(input: Buffer): Promise<ProcessedImage> {
  const options = {
    limitInputPixels: MEDIA_MAX_INPUT_PIXELS,
    failOn: 'error' as const,
    animated: false,
  };
  let width: number | undefined;
  let height: number | undefined;
  try {
    // En-tête seulement (aucun pixel décodé) : la borne de pixels est appliquée juste après,
    // avec un code d'erreur explicite (413 MEDIA_TOO_LARGE).
    ({ width, height } = await sharp(input, {
      ...options,
      limitInputPixels: false,
    }).metadata());
  } catch {
    throw invalidImage();
  }
  assertSafeDimensions(width ?? 0, height ?? 0);
  try {
    const { data, info } = await sharp(input, options)
      .timeout({ seconds: MEDIA_PROCESSING_TIMEOUT_SECONDS })
      .rotate()
      .resize({
        width: MEDIA_MAX_WIDTH,
        height: MEDIA_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: MEDIA_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      contentType: 'image/webp',
    };
  } catch {
    throw invalidImage();
  }
}
