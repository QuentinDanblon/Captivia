import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  MediaStorage,
  assertValidMediaKey,
  mediaPublicBaseUrl,
} from './media-storage';

export interface S3MediaStorageOptions {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
}

/** Options lues dans l'environnement (validées par Joi quand MEDIA_DRIVER=s3). */
export function s3OptionsFromEnv(): S3MediaStorageOptions {
  const bucket = process.env.MEDIA_BUCKET?.trim();
  if (!bucket) throw new Error('MEDIA_BUCKET is required when MEDIA_DRIVER=s3');
  return {
    bucket,
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    // Cloudflare R2 attend « auto ».
    region: process.env.S3_REGION?.trim() || 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  };
}

/**
 * Pilote S3 (Cloudflare R2, AWS S3, MinIO…). Les objets sont publics en lecture via le domaine
 * public du bucket (`MEDIA_PUBLIC_BASE_URL`, ex. domaine personnalisé R2) ; l'API n'expose jamais
 * les identifiants. Cache de 24 h au plus (`public, max-age=86400`) : le masquage d'un contenu ne
 * retire pas l'objet du bucket (procédure de purge : docs/RUNBOOK.md) ; sa suppression, si.
 */
export class S3MediaStorage implements MediaStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;

  constructor(
    private readonly options: S3MediaStorageOptions = s3OptionsFromEnv(),
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        region: options.region,
        endpoint: options.endpoint,
        forcePathStyle: options.forcePathStyle,
        credentials:
          options.accessKeyId && options.secretAccessKey
            ? {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
              }
            : undefined,
      });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertValidMediaKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // 24 h au plus : un contenu masqué ou supprimé ne reste pas des mois dans les caches
        // (navigateurs, CDN). Purge immédiate du CDN : docs/RUNBOOK.md, « Modération ».
        CacheControl: 'public, max-age=86400',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertValidMediaKey(key);
    // S3 / R2 : supprimer une clé absente réussit (204), l'opération est idempotente.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
  }

  async read(key: string): Promise<Buffer | null> {
    assertValidMediaKey(key);
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  publicUrl(key: string): string {
    return `${mediaPublicBaseUrl()}/${key}`;
  }
}
