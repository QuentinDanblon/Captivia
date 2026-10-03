import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { isOperator } from '../../common/operators';
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
  /** Texte alternatif saisi par l'auteur ; null = aucun (le client compose un repli). */
  alt: string | null;
}

/** Lecteur authentifié (facultatif) d'une image : `req.user` de la stratégie JWT. */
export interface MediaViewer {
  id: string;
  role?: string | null;
  emailVerified?: boolean;
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
    alt?: string | null;
  }): MediaView {
    return {
      id: media.id,
      url: this.url(media.key),
      width: media.width,
      height: media.height,
      alt: media.alt ?? null,
    };
  }

  /** Lecture d'un objet (pilote local : `GET /community/media/:key`). */
  read(key: string): Promise<Buffer | null> {
    return this.storage.read(key);
  }

  /**
   * Image lisible par `viewer` (pilote local) :
   * - aucune ligne `CommunityMedia` (fichier résiduel) : null ;
   * - image d'une publication masquée : seulement son auteur ou un opérateur (e-mail vérifié),
   *   `isPublic: false` (jamais mise en cache) ; sinon null (404) ;
   * - image d'une publication visible, avatar, image pas encore rattachée (clé aléatoire,
   *   connue de son seul auteur) : `isPublic: true`.
   */
  async readFor(
    key: string,
    viewer?: MediaViewer,
  ): Promise<{ data: Buffer; isPublic: boolean } | null> {
    const row = await this.prisma.communityMedia.findUnique({
      where: { key },
      select: { post: { select: { status: true, authorId: true } } },
    });
    if (!row) return null;
    let isPublic = true;
    if (row.post && row.post.status !== 'VISIBLE') {
      const allowed =
        !!viewer &&
        (viewer.id === row.post.authorId ||
          (isOperator(viewer) && viewer.emailVerified === true));
      if (!allowed) return null;
      isPublic = false;
    }
    const data = await this.storage.read(key);
    return data ? { data, isPublic } : null;
  }

  /**
   * Téléversement d'une image par un auteur (membre vérifié non suspendu), limité à
   * COMMUNITY_UPLOADS_PER_HOUR tentatives par compte : la tentative est consommée (sous verrou
   * consultatif du compte) AVANT le traitement, échecs compris — des envois invalides ou
   * parallèles ne contournent pas la limite. L'image n'est rattachée à rien : elle le sera par
   * la création d'une publication ou le choix d'un avatar, sinon purgée après 24 h.
   */
  async upload(userId: string, file: UploadedImage): Promise<MediaView> {
    await this.access.requirePublisher(userId);
    await this.access.withRateLimit(
      userId,
      'uploads',
      (tx, since) =>
        tx.communityUploadAttempt.count({
          where: { userId, createdAt: { gt: since } },
        }),
      uploadsPerHour(),
      HOUR_MS,
      (tx) => tx.communityUploadAttempt.create({ data: { userId } }),
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
