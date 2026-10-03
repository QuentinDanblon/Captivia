import { HttpStatus } from '@nestjs/common';
import sharpModule = require('sharp');
import {
  CommunityErrorCode,
  MEDIA_MAX_HEIGHT,
  MEDIA_MAX_INPUT_PIXELS,
  MEDIA_MAX_WIDTH,
  MEDIA_WEBP_QUALITY,
} from '../community.constants';
import { withStatus } from '../community.errors';

/**
 * sharp ≥ 0.35 publie des types ESM (`export default`) mais son point d'entrée CommonJS exporte
 * directement la fonction (`module.exports = sharp`) : le projet compile en CommonJS sans
 * esModuleInterop, d'où ce typage explicite.
 */
const sharp = sharpModule as unknown as typeof sharpModule.default;

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

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  contentType: 'image/webp';
}

/**
 * Chaîne de traitement d'une image téléversée, dans cet ordre :
 * 1. type réel (magic bytes) → 415 MEDIA_UNSUPPORTED_TYPE ;
 * 2. taille maximale → 413 MEDIA_TOO_LARGE ;
 * 3. décodage borné (pixels), orientation EXIF appliquée, redimensionnement à 1 600 px de large
 *    au plus (jamais d'agrandissement), ré-encodage WebP ;
 * 4. aucune métadonnée conservée : sharp n'écrit ni EXIF (dont GPS), ni XMP, ni IPTC tant que
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
  try {
    const { data, info } = await sharp(input, {
      limitInputPixels: MEDIA_MAX_INPUT_PIXELS,
      failOn: 'error',
      animated: false,
    })
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
    throw withStatus(
      HttpStatus.BAD_REQUEST,
      CommunityErrorCode.MEDIA_INVALID_IMAGE,
      'The image could not be decoded.',
    );
  }
}
