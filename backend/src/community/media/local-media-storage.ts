import { promises as fs } from 'fs';
import * as path from 'path';
import {
  MediaStorage,
  assertValidMediaKey,
  mediaPublicBaseUrl,
} from './media-storage';

/** Dossier par défaut du pilote local (relatif au répertoire de lancement, ignoré par git). */
export const DEFAULT_MEDIA_LOCAL_DIR = 'var/media';

/**
 * Pilote local : un fichier par objet dans `MEDIA_LOCAL_DIR` (défaut `var/media`).
 * Réservé au développement et aux tests : le disque d'un service Render gratuit est éphémère.
 */
export class LocalMediaStorage implements MediaStorage {
  readonly driver = 'local' as const;
  private readonly dir: string;

  constructor(dir = process.env.MEDIA_LOCAL_DIR || DEFAULT_MEDIA_LOCAL_DIR) {
    this.dir = path.resolve(dir);
  }

  private pathFor(key: string): string {
    assertValidMediaKey(key);
    return path.join(this.dir, key);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.pathFor(key);
    await fs.mkdir(this.dir, { recursive: true });
    // Écriture atomique : fichier temporaire puis renommage.
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, body, { mode: 0o640 });
    await fs.rename(tmp, file);
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  publicUrl(key: string): string {
    return `${mediaPublicBaseUrl()}/${key}`;
  }
}
