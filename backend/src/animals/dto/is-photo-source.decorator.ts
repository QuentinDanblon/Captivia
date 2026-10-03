import { registerDecorator, ValidationOptions } from 'class-validator';

/** Taille décodée maximale d'une photo envoyée en data URL (2 Mo). */
export const MAX_PHOTO_DATA_URL_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_URL_LENGTH = 2048;
const DATA_IMAGE_RE =
  /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;

export function isPhotoSource(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.startsWith('data:')) {
    const m = DATA_IMAGE_RE.exec(value);
    if (!m) return false;
    // Taille décodée approchée : 3 octets pour 4 caractères base64.
    const decoded = Math.floor((m[2].length * 3) / 4);
    return decoded <= MAX_PHOTO_DATA_URL_BYTES;
  }
  if (value.length > MAX_PHOTO_URL_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Photo d'animal : URL https, ou data URL `data:image/*` (upload depuis le
 * navigateur) de 2 Mo décodés maximum.
 */
export function IsPhotoSource(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPhotoSource',
      target: object.constructor,
      propertyName,
      options: {
        message: `each value in ${propertyName} must be an https URL or a data:image URL of at most 2 MB`,
        ...options,
        each: true,
      },
      validator: { validate: (value: unknown) => isPhotoSource(value) },
    });
  };
}
