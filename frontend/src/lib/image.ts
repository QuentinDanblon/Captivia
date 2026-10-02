/**
 * Compression côté client des photos avant envoi à l'API (W4-07).
 *
 * - redimensionne (côté le plus long <= 1600 px, sans agrandir) via un canvas ;
 * - ré-encode en JPEG (qualité 0.82) ;
 * - refuse les fichiers de plus de 10 Mo (`ImageTooLargeError`).
 */

export const MAX_IMAGE_DIMENSION = 1600;
export const IMAGE_JPEG_QUALITY = 0.82;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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
 * Retourne un data URL JPEG compressé. Si l'image ne peut pas être décodée ou si le canvas
 * n'est pas disponible, retourne le data URL d'origine (comportement antérieur).
 * @throws ImageTooLargeError si `file.size > MAX_IMAGE_BYTES`
 */
export async function compressImageToDataUrl(file: File | Blob): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new ImageTooLargeError();

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return readAsDataUrl(file);
  }

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  const { width, height } = computeTargetSize(srcWidth, srcHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return readAsDataUrl(file);

  // Fond blanc : le JPEG n'a pas de transparence (PNG/GIF/WebP transparents).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const compressed = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
  // toDataURL renvoie « data:, » (ou autre format) si l'encodage JPEG échoue.
  if (!compressed.startsWith('data:image/jpeg')) return readAsDataUrl(file);
  return compressed;
}
