import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityAccessService } from '../community-access.service';
import { mediaMaxBytes, uploadsPerHour } from '../community.config';
import {
  ORPHAN_MEDIA_GRACE_HOURS,
  ORPHAN_MEDIA_PURGE_MAX_PER_RUN,
} from '../community.constants';
import { processImage } from './image-processing';
import { MEDIA_STORAGE, type MediaStorage } from './media-storage';

const HOUR_MS = 60 * 60 * 1000;

export interface MediaView {
  id: string;
  url: string;
  width: number;
  height: number;
}

/** Fichier reçu par multer (stockage mémoire). */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/**
 * Médias communautaires : téléversement (contrôle, traitement, stockage), URL publiques et
 * suppression des fichiers (publication supprimée, compte supprimé, orphelins).
 */
@Injectable()
export class CommunityMediaService {
  private readonly logger = new Logger(CommunityMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  get driver(): MediaStorage['driver'] {
    return this.storage.driver;
  }

  url(key: string): string {
    return this.storage.publicUrl(key);
  }

  view(media: {
    id: string;
    key: string;
    width: number;
    height: number;
  }): MediaView {
    return {
      id: media.id,
      url: this.url(media.key),
      width: media.width,
      height: media.height,
    };
  }

  /** Lecture d'un objet (pilote local : `GET /community/media/:key`). */
  read(key: string): Promise<Buffer | null> {
    return this.storage.read(key);
  }

  /**
   * Téléversement d'une image par un auteur (membre vérifié non suspendu), limité à
   * COMMUNITY_UPLOADS_PER_HOUR par compte. L'image n'est rattachée à rien : elle le sera par la
   * création d'une publication ou le choix d'un avatar, sinon purgée après 24 h.
   */
  async upload(userId: string, file: UploadedImage): Promise<MediaView> {
    await this.access.requirePublisher(userId);
    await this.access.enforceRate(
      (since) =>
        this.prisma.communityMedia.count({
          where: { ownerId: userId, createdAt: { gt: since } },
        }),
      uploadsPerHour(),
      HOUR_MS,
      'uploads',
    );
    const image = await processImage(file.buffer, mediaMaxBytes());
    const key = `${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    try {
      const media = await this.prisma.communityMedia.create({
        data: {
          ownerId: userId,
          key,
          mimeType: image.contentType,
          width: image.width,
          height: image.height,
          bytes: image.data.length,
        },
        select: { id: true, key: true, width: true, height: true },
      });
      return this.view(media);
    } catch (error) {
      await this.deleteFiles([key]);
      throw error;
    }
  }

  /**
   * Supprime les fichiers puis les lignes `CommunityMedia` des clés données. Un fichier dont la
   * suppression échoue garde sa ligne (détachée) : le job de maintenance réessaiera.
   */
  async purgeKeys(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const deleted = await this.deleteFiles(keys);
    if (deleted.length > 0) {
      await this.prisma.communityMedia.deleteMany({
        where: { key: { in: deleted } },
      });
    }
    return deleted.length;
  }

  /**
   * Purge des médias orphelins (job de maintenance) : ni publication ni avatar, et soit
   * propriétaire supprimé, soit téléversés depuis plus de ORPHAN_MEDIA_GRACE_HOURS heures.
   * `db` : client de la transaction de maintenance (verrou consultatif) ou client courant.
   */
  async purgeOrphans(
    now: Date = new Date(),
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const cutoff = new Date(now.getTime() - ORPHAN_MEDIA_GRACE_HOURS * HOUR_MS);
    const orphans = await db.communityMedia.findMany({
      where: {
        postId: null,
        avatarOf: { is: null },
        OR: [{ ownerId: null }, { createdAt: { lt: cutoff } }],
      },
      select: { key: true },
      orderBy: { createdAt: 'asc' },
      take: ORPHAN_MEDIA_PURGE_MAX_PER_RUN,
    });
    const keys = orphans.map((o) => o.key);
    const deleted = await this.deleteFiles(keys);
    if (deleted.length > 0) {
      await db.communityMedia.deleteMany({ where: { key: { in: deleted } } });
    }
    return deleted.length;
  }

  /** Supprime les fichiers ; renvoie les clés effectivement supprimées. */
  private async deleteFiles(keys: string[]): Promise<string[]> {
    const done: string[] = [];
    for (const key of keys) {
      try {
        await this.storage.delete(key);
        done.push(key);
      } catch (error) {
        this.logger.warn(
          `Suppression du média ${key} en échec (nouvel essai par la maintenance) : ${
            error instanceof Error ? error.message : 'erreur inconnue'
          }`,
        );
      }
    }
    return done;
  }
}
