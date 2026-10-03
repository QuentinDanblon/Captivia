import { Injectable } from '@nestjs/common';
import { CommunityPostType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from './community-access.service';
import { commentsPerMinute, postsPerHour } from './community.config';
import {
  COMMENTS_PAGE_SIZE,
  CommunityErrorCode,
  PHOTO_POST_MAX_MEDIA,
  PHOTO_POST_MIN_MEDIA,
  QUESTION_POST_MAX_MEDIA,
  REPLIES_PER_COMMENT,
  toCommunityCategory,
} from './community.constants';
import { badRequest, forbidden, notFound } from './community.errors';
import {
  CommentRow,
  CommentView,
  CommunityPresenter,
  PostView,
  commentSelect,
  postSelect,
} from './community.presenter';
import { afterCursor, decodeCursor, paginate } from './cursor';
import { handleKey } from './handle';
import { CommunityMediaService } from './media/community-media.service';
import { cleanText, containsLink, isNewAccount } from './text-filters';
import {
  CreateCommentDto,
  CreatePostDto,
  FeedQueryDto,
} from './dto/community.dto';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Publications, commentaires, « j'aime » et fils.
 *
 * Visibilité pour un lecteur : contenu VISIBLE (l'auteur voit aussi ses contenus masqués), auteur
 * avec un profil actif, aucun blocage entre l'auteur et le lecteur dans un sens ou dans l'autre.
 * Séparation stricte : seuls le nom et l'espèce d'un animal lié sont lus (jamais le carnet).
 */
@Injectable()
export class CommunityPostsService {
  private readonly presenter: CommunityPresenter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly media: CommunityMediaService,
  ) {
    this.presenter = new CommunityPresenter(media);
  }

  // -------------------------------------------------------------------------
  // Fils
  // -------------------------------------------------------------------------

  private visiblePosts(viewerId: string): Prisma.CommunityPostWhereInput {
    return {
      status: 'VISIBLE',
      author: this.access.visibleAuthor(viewerId),
    };
  }

  /** Fil récent (option : catégorie d'espèce, type), curseur (createdAt, id) décroissant. */
  async feed(viewerId: string, q: FeedQueryDto): Promise<Page<PostView>> {
    await this.access.loadActor(viewerId);
    const where: Prisma.CommunityPostWhereInput = {
      AND: [
        this.visiblePosts(viewerId),
        q.category ? { speciesCategory: q.category } : {},
        q.type ? { type: q.type } : {},
        afterCursor(decodeCursor(q.cursor)),
      ],
    };
    return this.listPosts(viewerId, where, q.limit);
  }

  /** Publications d'un membre (par pseudo). L'auteur voit aussi ses contenus masqués. */
  async userFeed(
    viewerId: string,
    handle: string,
    q: { cursor?: string; limit: number },
  ): Promise<Page<PostView>> {
    const authorId = await this.resolveVisibleHandle(viewerId, handle);
    const where: Prisma.CommunityPostWhereInput = {
      AND: [
        { authorId },
        authorId === viewerId ? {} : { status: 'VISIBLE' },
        afterCursor(decodeCursor(q.cursor)),
      ],
    };
    return this.listPosts(viewerId, where, q.limit);
  }

  private async listPosts(
    viewerId: string,
    where: Prisma.CommunityPostWhereInput,
    limit: number,
  ): Promise<Page<PostView>> {
    const rows = await this.prisma.communityPost.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: postSelect(viewerId),
    });
    const page = paginate(rows, limit);
    return {
      items: page.items.map((r) => this.presenter.post(r, viewerId)),
      nextCursor: page.nextCursor,
    };
  }

  /** Identifiant d'un membre visible par le lecteur (404 si inconnu ou bloqué). */
  async resolveVisibleHandle(
    viewerId: string,
    handle: string,
  ): Promise<string> {
    const profile = await this.prisma.communityProfile.findUnique({
      where: { handleKey: handleKey(handle) },
      select: { userId: true },
    });
    if (
      !profile ||
      (await this.access.isBlockedEitherWay(viewerId, profile.userId))
    ) {
      throw notFound();
    }
    return profile.userId;
  }

  // -------------------------------------------------------------------------
  // Détail
  // -------------------------------------------------------------------------

  /** Publication lisible par `viewerId`, sinon 404 (masquée, bloquée, inexistante). */
  private async readablePost(viewerId: string, postId: string) {
    const row = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        OR: [{ authorId: viewerId }, this.visiblePosts(viewerId)],
      },
      select: postSelect(viewerId),
    });
    if (!row) throw notFound();
    return row;
  }

  async getPost(
    viewerId: string,
    postId: string,
  ): Promise<PostView & { comments: Page<CommentView> }> {
    await this.access.loadActor(viewerId);
    const row = await this.readablePost(viewerId, postId);
    const comments = await this.commentPage(
      viewerId,
      postId,
      row.helpfulCommentId,
      undefined,
      COMMENTS_PAGE_SIZE,
    );
    return { ...this.presenter.post(row, viewerId), comments };
  }

  async listComments(
    viewerId: string,
    postId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Page<CommentView>> {
    await this.access.loadActor(viewerId);
    const row = await this.readablePost(viewerId, postId);
    return this.commentPage(
      viewerId,
      postId,
      row.helpfulCommentId,
      cursor,
      limit,
    );
  }

  private visibleComments(viewerId: string): Prisma.CommunityCommentWhereInput {
    return {
      OR: [
        { authorId: viewerId },
        { status: 'VISIBLE', author: this.access.visibleAuthor(viewerId) },
      ],
    };
  }

  /** Commentaires racines (chronologiques, curseur) avec leurs réponses visibles. */
  private async commentPage(
    viewerId: string,
    postId: string,
    helpfulCommentId: string | null,
    cursor: string | undefined,
    limit: number,
  ): Promise<Page<CommentView>> {
    const rows = await this.prisma.communityComment.findMany({
      where: {
        AND: [
          { postId, parentId: null },
          this.visibleComments(viewerId),
          afterCursor(decodeCursor(cursor), 'asc'),
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        ...commentSelect,
        replies: {
          where: this.visibleComments(viewerId),
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: REPLIES_PER_COMMENT,
          select: commentSelect,
        },
      },
    });
    const page = paginate(rows, limit);
    return {
      items: page.items.map((c) => ({
        ...this.presenter.comment(c as CommentRow, viewerId, helpfulCommentId),
        replies: c.replies.map((r) =>
          this.presenter.comment(r, viewerId, helpfulCommentId),
        ),
      })),
      nextCursor: page.nextCursor,
    };
  }

  // -------------------------------------------------------------------------
  // Écriture
  // -------------------------------------------------------------------------

  /** Refuse les liens aux comptes de moins de LINKS_MIN_ACCOUNT_AGE_DAYS jours. */
  private assertLinksAllowed(body: string, accountCreatedAt: Date): void {
    if (body && isNewAccount(accountCreatedAt) && containsLink(body)) {
      throw badRequest(
        CommunityErrorCode.LINKS_NOT_ALLOWED,
        'Links are not allowed during the first 7 days of an account.',
      );
    }
  }

  async createPost(userId: string, dto: CreatePostDto): Promise<PostView> {
    const actor = await this.access.requirePublisher(userId);
    await this.access.enforceRate(
      (since) =>
        this.prisma.communityPost.count({
          where: { authorId: userId, createdAt: { gt: since } },
        }),
      postsPerHour(),
      HOUR_MS,
      'posts',
    );

    const body = cleanText(dto.body);
    if (dto.type === CommunityPostType.QUESTION && !body) {
      throw badRequest('COMMUNITY_BODY_REQUIRED', 'A question needs a text.');
    }
    this.assertLinksAllowed(body, actor.createdAt);

    const mediaIds = dto.mediaIds ?? [];
    const [min, max] =
      dto.type === CommunityPostType.PHOTO
        ? [PHOTO_POST_MIN_MEDIA, PHOTO_POST_MAX_MEDIA]
        : [0, QUESTION_POST_MAX_MEDIA];
    if (mediaIds.length < min || mediaIds.length > max) {
      throw badRequest(
        CommunityErrorCode.INVALID_MEDIA,
        `A ${dto.type.toLowerCase()} post takes ${min} to ${max} image(s).`,
      );
    }
    const owned = await this.prisma.communityMedia.count({
      where: {
        id: { in: mediaIds },
        ownerId: userId,
        postId: null,
        avatarOf: { is: null },
      },
    });
    if (owned !== mediaIds.length) {
      throw badRequest(
        CommunityErrorCode.INVALID_MEDIA,
        'Unknown or already used image.',
      );
    }

    let speciesCategory = dto.speciesCategory ?? null;
    if (dto.animalId) {
      // Seule lecture d'un animal : appartenance + catégorie d'espèce (jamais le carnet).
      const animal = await this.prisma.animal.findFirst({
        where: { id: dto.animalId, userId },
        select: { speciesProfile: { select: { category: true } } },
      });
      if (!animal) throw notFound('Animal not found');
      speciesCategory ??= toCommunityCategory(animal.speciesProfile.category);
    }

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.communityPost.create({
        data: {
          authorId: userId,
          type: dto.type,
          body,
          speciesCategory,
          animalId: dto.animalId ?? null,
        },
        select: { id: true },
      });
      for (const [position, id] of mediaIds.entries()) {
        const res = await tx.communityMedia.updateMany({
          where: { id, ownerId: userId, postId: null },
          data: { postId: created.id, position },
        });
        if (res.count !== 1) {
          throw badRequest(
            CommunityErrorCode.INVALID_MEDIA,
            'Unknown or already used image.',
          );
        }
      }
      return created;
    });
    return this.presenter.post(
      await this.readablePost(userId, post.id),
      userId,
    );
  }

  /** Suppression par l'auteur : la publication, ses commentaires, ses images (fichiers compris). */
  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, authorId: userId },
      select: { id: true, media: { select: { key: true } } },
    });
    if (!post) throw notFound();
    await this.prisma.communityPost.delete({ where: { id: postId } });
    await this.media.purgeKeys(post.media.map((m) => m.key));
  }

  /** « J'aime » idempotent : un second appel ne change rien. */
  async like(
    userId: string,
    postId: string,
  ): Promise<{ liked: true; likeCount: number }> {
    await this.access.requireMember(userId);
    await this.readableVisiblePost(userId, postId);
    await this.prisma.communityReaction.createMany({
      data: [{ postId, userId }],
      skipDuplicates: true,
    });
    return {
      liked: true,
      likeCount: await this.prisma.communityReaction.count({
        where: { postId },
      }),
    };
  }

  async unlike(
    userId: string,
    postId: string,
  ): Promise<{ liked: false; likeCount: number }> {
    await this.access.loadActor(userId);
    await this.prisma.communityReaction.deleteMany({
      where: { postId, userId },
    });
    return {
      liked: false,
      likeCount: await this.prisma.communityReaction.count({
        where: { postId },
      }),
    };
  }

  /** Publication visible (statut VISIBLE même pour l'auteur) et non bloquée, sinon 404. */
  private async readableVisiblePost(viewerId: string, postId: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        status: 'VISIBLE',
        OR: [
          { authorId: viewerId },
          { author: this.access.visibleAuthor(viewerId) },
        ],
      },
      select: { id: true, authorId: true, type: true },
    });
    if (!post) throw notFound();
    return post;
  }

  async createComment(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    const actor = await this.access.requirePublisher(userId);
    await this.readableVisiblePost(userId, postId);
    await this.access.enforceRate(
      (since) =>
        this.prisma.communityComment.count({
          where: { authorId: userId, createdAt: { gt: since } },
        }),
      commentsPerMinute(),
      MINUTE_MS,
      'comments',
    );
    const body = cleanText(dto.body);
    if (!body) {
      throw badRequest('COMMUNITY_BODY_REQUIRED', 'A comment needs a text.');
    }
    this.assertLinksAllowed(body, actor.createdAt);

    if (dto.parentId) {
      const parent = await this.prisma.communityComment.findFirst({
        where: {
          AND: [
            { id: dto.parentId, postId, parentId: null, status: 'VISIBLE' },
            this.visibleComments(userId),
          ],
        },
        select: { id: true },
      });
      if (!parent) {
        throw badRequest(
          'COMMUNITY_INVALID_PARENT',
          'Replies are only possible on a visible top-level comment of this post.',
        );
      }
    }
    const comment = await this.prisma.communityComment.create({
      data: { postId, authorId: userId, parentId: dto.parentId ?? null, body },
      select: commentSelect,
    });
    return this.presenter.comment(comment, userId, null);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const res = await this.prisma.communityComment.deleteMany({
      where: { id: commentId, authorId: userId },
    });
    if (res.count === 0) throw notFound();
  }

  /** « Réponse utile » : réservée à l'auteur d'une question, un commentaire à la fois. */
  async markHelpful(
    userId: string,
    commentId: string,
    helpful: boolean,
  ): Promise<{ postId: string; helpfulCommentId: string | null }> {
    await this.access.requireMember(userId);
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        status: true,
        post: {
          select: {
            id: true,
            authorId: true,
            type: true,
            helpfulCommentId: true,
          },
        },
      },
    });
    if (!comment) throw notFound();
    const { post } = comment;
    if (post.authorId !== userId) {
      throw forbidden(
        'COMMUNITY_NOT_POST_AUTHOR',
        'Only the author of the question can mark a helpful answer.',
      );
    }
    if (post.type !== CommunityPostType.QUESTION) {
      throw badRequest(
        'COMMUNITY_NOT_A_QUESTION',
        'Only questions have a helpful answer.',
      );
    }
    if (helpful && comment.status !== 'VISIBLE') throw notFound();
    let helpfulCommentId = post.helpfulCommentId;
    if (helpful) helpfulCommentId = comment.id;
    else if (post.helpfulCommentId === comment.id) helpfulCommentId = null;
    await this.prisma.communityPost.update({
      where: { id: post.id },
      data: { helpfulCommentId },
    });
    return { postId: post.id, helpfulCommentId };
  }
}
