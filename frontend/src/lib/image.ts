/**
 * Compression côté client des photos avant envoi à l'API (W4-07).
 *
 * - redimensionne (côté le plus long <= 1600 px, sans agrandir) via un canvas ;
 * - ré-encode en JPEG, en baissant la qualité puis la taille jusqu'à passer sous
 *   `ANIMAL_PHOTO_TARGET_BYTES` : l'envoi reste toujours sous la limite de l'API (2 Mo décodés) ;
 * - refuse les fichiers de plus de 30 Mo (`ImageTooLargeError`) et les formats que le navigateur
 *   ne sait pas lire (HEIC hors Safari… : `UnsupportedImageError`), au lieu d'envoyer le fichier
 *   brut que l'API refuserait.
 */

export const MAX_IMAGE_DIMENSION = 1600;
export const IMAGE_JPEG_QUALITY = 0.82;
/** Taille maximale de la photo d'origine (photos de téléphone récentes : souvent 10 à 20 Mo). */
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Taille visée après compression (décodée) ; l'API accepte 2 Mo, on garde une marge. */
export const ANIMAL_PHOTO_TARGET_BYTES = 1_200_000;
/** Plafond accepté par l'API pour une photo en data URL (`IsPhotoSource`, 2 Mo décodés). */
const API_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Paliers successifs (côté le plus long, qualité JPEG) tant que la cible n'est pas atteinte. */
const COMPRESSION_STEPS: ReadonlyArray<readonly [number, number]> = [
  [MAX_IMAGE_DIMENSION, IMAGE_JPEG_QUALITY],
  [MAX_IMAGE_DIMENSION, 0.7],
  [1280, 0.7],
  [1024, 0.65],
  [800, 0.6],
];

/** Levée quand le fichier source dépasse `MAX_IMAGE_BYTES` (à traduire côté UI). */
export class ImageTooLargeError extends Error {
  constructor() {
    super('IMAGE_TOO_LARGE');
    this.name = 'ImageTooLargeError';
  }
}

export function isImageTooLargeError(err: unknown): err is ImageTooLargeError {
  return err instanceof ImageTooLargeError;
}

/** Dimensions cibles : le côté le plus long est ramené à `max`, jamais d'agrandissement. */
export function computeTargetSize(
  width: number,
  height: number,
  max: number = MAX_IMAGE_DIMENSION,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width, height };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Taille décodée approchée d'une data URL base64 (3 octets pour 4 caractères). */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode error'));
    };
    img.src = url;
  });
}

/**
 * Sans décodage possible (canvas absent, image illisible) : le fichier n'est envoyé tel quel que
 * s'il est dans un format et une taille que l'API accepte ; sinon, erreur explicite.
 */
async function originalIfAcceptable(file: Blob): Promise<string> {
  const type = await sniffImageType(file);
  if (type === 'heic') throw new UnsupportedImageError('heic');
  if (type !== 'jpeg' && type !== 'png' && type !== 'webp' && type !== 'gif') {
    throw new UnsupportedImageError('type');
  }
  if (file.size > API_PHOTO_MAX_BYTES) throw new ImageTooLargeError();
  return readAsDataUrl(file);
}

/**
 * Retourne un data URL JPEG compressé, toujours sous `ANIMAL_PHOTO_TARGET_BYTES` quand le
 * navigateur sait décoder l'image (sinon : original s'il est acceptable, erreur sinon).
 * @throws ImageTooLargeError si `file.size > MAX_IMAGE_BYTES`
 * @throws UnsupportedImageError si le format n'est pas lisible ici (ex. HEIC hors Safari)
 */
export async function compressImageToDataUrl(file: File | Blob): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new ImageTooLargeError();

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return originalIfAcceptable(file);
  }

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return originalIfAcceptable(file);

  let smallest: string | null = null;
  for (const [maxSide, quality] of COMPRESSION_STEPS) {
    const { width, height } = computeTargetSize(srcWidth, srcHeight, maxSide);
    canvas.width = width;
    canvas.height = height;
    // Fond blanc : le JPEG n'a pas de transparence (PNG/GIF/WebP transparents).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const encoded = canvas.toDataURL('image/jpeg', quality);
    // toDataURL renvoie « data:, » (ou autre format) si l'encodage JPEG échoue.
    if (!encoded.startsWith('data:image/jpeg')) return originalIfAcceptable(file);
    if (smallest === null || dataUrlBytes(encoded) < dataUrlBytes(smallest)) smallest = encoded;
    if (dataUrlBytes(encoded) <= ANIMAL_PHOTO_TARGET_BYTES) return encoded;
  }
  if (smallest && dataUrlBytes(smallest) <= API_PHOTO_MAX_BYTES) return smallest;
  throw new ImageTooLargeError();
}

// ---------------------------------------------------------------------------------------------
// Communauté : préparation des photos avant téléversement (POST /community/media)
// ---------------------------------------------------------------------------------------------

/**
 * Types acceptés par l'API (contrôle par signature binaire côté serveur) : JPEG, PNG et WebP.
 * Les photos HEIC / HEIF (iPhone) sont converties en JPEG quand le navigateur sait les décoder
 * (Safari), refusées avec un message clair sinon (`UnsupportedImageError`, `reason: 'heic'`).
 */
export type SniffedImageType = 'jpeg' | 'png' | 'webp' | 'heic' | 'gif' | 'other';

/** Taille maximale de la photo d'origine (avant compression), au-delà : `ImageTooLargeError`. */
export const COMMUNITY_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
/** Plafond de la photo envoyée (le backend refuse au-delà de MEDIA_MAX_BYTES, 8 Mo par défaut). */
export const COMMUNITY_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

/** Au-delà, le serveur refuse l'image : côté le plus long > 10 000 px ou rapport des côtés > 20. */
export const COMMUNITY_MAX_SOURCE_DIMENSION = 10_000;
export const COMMUNITY_MAX_ASPECT_RATIO = 20;

/** Vrai si les dimensions d'origine seraient refusées par l'API (bandes extrêmes, panoramas géants). */
export function hasExtremeDimensions(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = Math.max(width, height) / Math.min(width, height);
  return Math.max(width, height) > COMMUNITY_MAX_SOURCE_DIMENSION || ratio > COMMUNITY_MAX_ASPECT_RATIO;
}

/**
 * Photo refusée : `heic` (HEIC/HEIF non décodable ici), `type` (ni JPEG, ni PNG, ni WebP) ou
 * `dimensions` (côté > 10 000 px ou rapport > 20).
 */
export class UnsupportedImageError extends Error {
  readonly reason: 'heic' | 'type' | 'dimensions';

  constructor(reason: 'heic' | 'type' | 'dimensions') {
    super(reason === 'heic' ? 'IMAGE_HEIC_UNSUPPORTED' : reason === 'dimensions' ? 'IMAGE_DIMENSIONS_UNSUPPORTED' : 'IMAGE_TYPE_UNSUPPORTED');
    this.name = 'UnsupportedImageError';
    this.reason = reason;
  }
}

export function isUnsupportedImageError(err: unknown): err is UnsupportedImageError {
  return err instanceof UnsupportedImageError;
}

function readHead(file: Blob, bytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, bytes);
  if (typeof slice.arrayBuffer === 'function') return slice.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsArrayBuffer(slice);
  });
}

/** Type réel d'une image d'après ses premiers octets (le type MIME déclaré n'est qu'un indice). */
export function sniffImageBytes(head: Uint8Array): SniffedImageType {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(head.slice(from, to)));
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 8 && head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (head.length >= 6 && ascii(0, 4) === 'GIF8') return 'gif';
  if (head.length >= 12 && ascii(4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(8, 12).toLowerCase())) return 'heic';
  return 'other';
}

export async function sniffImageType(file: Blob): Promise<SniffedImageType> {
  const sniffed = sniffImageBytes(await readHead(file, 16));
  if (sniffed !== 'other') return sniffed;
  // Fichier illisible mais déclaré HEIC (extension, type MIME) : traité comme tel.
  const name = (file as File).name ?? '';
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(name)) return 'heic';
  return 'other';
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob && blob.type === 'image/jpeg' ? blob : null), 'image/jpeg', IMAGE_JPEG_QUALITY);
  });
}

export interface PreparedImage {
  /** Image à téléverser (JPEG compressé, ou l'original s'il est déjà acceptable). */
  blob: Blob;
  /** Nom de fichier envoyé (extension cohérente avec le contenu). */
  filename: string;
  width: number;
  height: number;
  /** Vrai si une photo HEIC a été convertie en JPEG. */
  converted: boolean;
}

function asIs(file: Blob, type: SniffedImageType, width = 0, height = 0): PreparedImage {
  if (file.size > COMMUNITY_UPLOAD_MAX_BYTES) throw new ImageTooLargeError();
  return { blob: file, filename: `photo.${type === 'jpeg' ? 'jpg' : type}`, width, height, converted: false };
}

/**
 * Prépare une photo pour la communauté : vérifie le type réel, convertit HEIC → JPEG si possible,
 * redimensionne (1 600 px au plus) et ré-encode en JPEG 0,82. Les métadonnées (EXIF, GPS) ne
 * survivent pas au passage par le canvas ; le serveur les retire de toute façon.
 * @throws ImageTooLargeError photo d'origine > 20 Mo, ou > 8 Mo après traitement
 * @throws UnsupportedImageError HEIC non décodable, ou type non accepté
 */
export async function prepareCommunityImage(file: Blob): Promise<PreparedImage> {
  if (file.size > COMMUNITY_SOURCE_MAX_BYTES) throw new ImageTooLargeError();
  const type = await sniffImageType(file);
  if (type === 'other' || type === 'gif') throw new UnsupportedImageError('type');

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    if (type === 'heic') throw new UnsupportedImageError('heic');
    // Navigateur incapable de décoder : l'original (JPEG, PNG, WebP) part tel quel, contrôlé par l'API.
    return asIs(file, type);
  }

  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  // Une très grande photo est ramenée à 1 600 px ici ; mais le rapport des côtés est conservé :
  // une bande extrême (> 20) serait refusée par l'API, on le dit avant l'envoi.
  if (sourceWidth > 0 && sourceHeight > 0 && Math.max(sourceWidth, sourceHeight) / Math.min(sourceWidth, sourceHeight) > COMMUNITY_MAX_ASPECT_RATIO) {
    throw new UnsupportedImageError('dimensions');
  }
  const { width, height } = computeTargetSize(sourceWidth, sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  let jpeg: Blob | null = null;
  if (ctx) {
    // Fond clair : le JPEG n'a pas de transparence (PNG / WebP détourés).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    jpeg = await canvasToJpeg(canvas);
  }
  if (!jpeg) {
    if (type === 'heic') throw new UnsupportedImageError('heic');
    return asIs(file, type, width, height);
  }
  if (jpeg.size > COMMUNITY_UPLOAD_MAX_BYTES) throw new ImageTooLargeError();
  return { blob: jpeg, filename: 'photo.jpg', width, height, converted: type === 'heic' };
}
