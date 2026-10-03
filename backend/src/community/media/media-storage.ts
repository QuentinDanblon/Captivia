/**
 * Stockage des médias communautaires (images déjà traitées : WebP, sans métadonnées).
 *
 * Deux pilotes, choisis par `MEDIA_DRIVER` :
 * - `local` (défaut, développement et tests) : fichiers dans `MEDIA_LOCAL_DIR`, servis par
 *   `GET /community/media/:key` ;
 * - `s3` : tout stockage objet compatible S3 (Cloudflare R2, AWS S3, MinIO…), servi directement
 *   par le domaine public du bucket (`MEDIA_PUBLIC_BASE_URL`).
 *
 * Les clés sont aléatoires (`<uuid>.webp`) et ne contiennent aucune donnée personnelle ; l'URL
 * publique d'une image est stable : `${MEDIA_PUBLIC_BASE_URL}/${key}`.
 */
export interface MediaStorage {
  readonly driver: 'local' | 's3';
  /** Écrit (ou remplace) l'objet. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Supprime l'objet ; idempotent (absent = succès). */
  delete(key: string): Promise<void>;
  /** Contenu de l'objet, ou null s'il n'existe pas (pilote local : service HTTP des fichiers). */
  read(key: string): Promise<Buffer | null>;
  /** URL publique stable de l'objet. */
  publicUrl(key: string): string;
}

/** Jeton d'injection Nest du pilote actif. */
export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

/** Format unique des clés : `<uuid v4>.webp` (empêche toute traversée de chemin). */
export const MEDIA_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isValidMediaKey(key: string): boolean {
  return MEDIA_KEY_PATTERN.test(key);
}

export function assertValidMediaKey(key: string): void {
  if (!isValidMediaKey(key)) throw new Error('Invalid media key');
}

/** `MEDIA_PUBLIC_BASE_URL` sans barre finale ; défaut du pilote local : l'API en développement. */
export function mediaPublicBaseUrl(): string {
  const configured = process.env.MEDIA_PUBLIC_BASE_URL?.trim();
  const base =
    configured ||
    `http://localhost:${process.env.PORT || '3001'}/community/media`;
  return base.replace(/\/+$/, '');
}
