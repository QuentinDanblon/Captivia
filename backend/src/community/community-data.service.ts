import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityMediaService } from './media/community-media.service';

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Données communautaires d'un compte au regard du RGPD : export (art. 15 et 20) et effacement
 * (art. 17), fichiers des images compris. Utilisé par AccountService (export et suppression du
 * compte) et par la désactivation du profil communautaire.
 *
 * Le journal de modération n'est pas effacé : il est conservé au titre de l'obligation de
 * motivation et de traitement des recours (DSA), sans lien vers le compte supprimé
 * (`subjectId` passe à NULL), puis purgé par le job de maintenance.
 */
@Injectable()
export class CommunityDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: CommunityMediaService,
  ) {}

  /** Clés des images du compte (à effacer après la suppression des lignes). */
  async mediaKeysOf(userId: string, db: Db = this.prisma): Promise<string[]> {
    const rows = await db.communityMedia.findMany({
      where: { ownerId: userId },
      select: { key: true },
    });
    return rows.map((r) => r.key);
  }

  /**
   * Supprime les lignes communautaires du compte (dans la transaction fournie). Les lignes
   * `CommunityMedia` restent, détachées, jusqu'à `purgeMedia` (suppression des fichiers).
   * `includeIncomingBlocks` : supprimer aussi les blocages posés par d'autres membres sur ce compte
   * (suppression du compte : oui ; simple départ de la communauté : non, ils appartiennent à leurs
   * auteurs).
   */
  async deleteRows(
    db: Db,
    userId: string,
    includeIncomingBlocks: boolean,
  ): Promise<void> {
    await db.communityReaction.deleteMany({ where: { userId } });
    await db.communityReport.deleteMany({ where: { reporterId: userId } });
    await db.communityBlock.deleteMany({
      where: includeIncomingBlocks
        ? { OR: [{ blockerId: userId }, { blockedId: userId }] }
        : { blockerId: userId },
    });
    await db.communityComment.deleteMany({ where: { authorId: userId } });
    await db.communityPost.deleteMany({ where: { authorId: userId } });
    await db.communityProfile.deleteMany({ where: { userId } });
    await db.communityMedia.updateMany({
      where: { ownerId: userId },
      data: { postId: null },
    });
  }

  /** Efface les fichiers puis les lignes des images ; les échecs sont repris par la maintenance. */
  purgeMedia(keys: string[]): Promise<number> {
    return this.media.purgeKeys(keys);
  }

  /** Départ de la communauté : profil, contenus, réactions, signalements émis, images. */
  async leaveCommunity(userId: string): Promise<void> {
    const keys = await this.mediaKeysOf(userId);
    await this.prisma.$transaction((tx) => this.deleteRows(tx, userId, false));
    await this.purgeMedia(keys);
  }

  /** Section « community » de l'export RGPD. */
  async exportFor(userId: string) {
    const [
      profile,
      posts,
      comments,
      reactions,
      reports,
      blocks,
      decisions,
      media,
    ] = await Promise.all([
      this.prisma.communityProfile.findUnique({
        where: { userId },
        select: {
          handle: true,
          rulesVersion: true,
          rulesAcceptedAt: true,
          ageConfirmedAt: true,
          suspendedUntil: true,
          createdAt: true,
          updatedAt: true,
          avatar: { select: { key: true } },
        },
      }),
      this.prisma.communityPost.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          body: true,
          speciesCategory: true,
          animalId: true,
          status: true,
          hiddenAt: true,
          helpfulCommentId: true,
          createdAt: true,
          updatedAt: true,
          media: {
            orderBy: { position: 'asc' },
            select: { key: true, width: true, height: true },
          },
        },
      }),
      this.prisma.communityComment.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          postId: true,
          parentId: true,
          body: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.communityReaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { postId: true, createdAt: true },
      }),
      this.prisma.communityReport.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          postId: true,
          commentId: true,
          reason: true,
          details: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
      this.prisma.communityBlock.findMany({
        where: { blockerId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          blocked: {
            select: { communityProfile: { select: { handle: true } } },
          },
        },
      }),
      this.prisma.communityModerationAction.findMany({
        where: { subjectId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          targetType: true,
          reason: true,
          statement: true,
          automated: true,
          suspendedUntil: true,
          notifiedAt: true,
          appealStatus: true,
          appealText: true,
          appealedAt: true,
          appealResolvedAt: true,
          appealStatement: true,
          createdAt: true,
        },
      }),
      this.prisma.communityMedia.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          key: true,
          postId: true,
          width: true,
          height: true,
          bytes: true,
          createdAt: true,
        },
      }),
    ]);

    const url = (key: string) => this.media.url(key);
    return {
      profile: profile
        ? {
            handle: profile.handle,
            avatarUrl: profile.avatar ? url(profile.avatar.key) : null,
            rulesVersion: profile.rulesVersion,
            rulesAcceptedAt: profile.rulesAcceptedAt,
            ageConfirmedAt: profile.ageConfirmedAt,
            suspendedUntil: profile.suspendedUntil,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          }
        : null,
      posts: posts.map(({ media: m, ...p }) => ({
        ...p,
        media: m.map((x) => ({
          url: url(x.key),
          width: x.width,
          height: x.height,
        })),
      })),
      comments,
      reactions,
      reportsFiled: reports,
      blocks: blocks.map((b) => ({
        handle: b.blocked.communityProfile?.handle ?? null,
        createdAt: b.createdAt,
      })),
      moderationDecisions: decisions,
      media: media.map(({ key, ...m }) => ({ url: url(key), ...m })),
    };
  }
}
