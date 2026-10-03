import { Prisma } from '@prisma/client';
import {
  CommunityMediaService,
  MediaView,
} from './media/community-media.service';

/**
 * Sélections Prisma et mise en forme des réponses publiques.
 *
 * Règle : une réponse communautaire n'expose JAMAIS l'e-mail ni l'identifiant interne d'un compte,
 * ni aucune donnée du carnet de santé. Les sélections ci-dessous sont explicites (`select`, jamais
 * `include`) : l'auteur se résume à son pseudo et à son avatar ; l'animal lié à son nom et à son
 * espèce.
 */

export const authorSelect = {
  communityProfile: {
    select: { handle: true, avatar: { select: { key: true } } },
  },
} satisfies Prisma.UserSelect;

export const animalSelect = {
  name: true,
  speciesProfile: { select: { commonNameFr: true, scientificName: true } },
} satisfies Prisma.AnimalSelect;

export function postSelect(viewerId: string) {
  return {
    id: true,
    type: true,
    body: true,
    speciesCategory: true,
    status: true,
    createdAt: true,
    authorId: true,
    helpfulCommentId: true,
    author: { select: authorSelect },
    animal: { select: animalSelect },
    media: {
      orderBy: { position: 'asc' },
      select: { id: true, key: true, width: true, height: true },
    },
    _count: {
      select: {
        reactions: true,
        comments: { where: { status: 'VISIBLE' } },
      },
    },
    reactions: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.CommunityPostSelect;
}

export type PostRow = Prisma.CommunityPostGetPayload<{
  select: ReturnType<typeof postSelect>;
}>;

export const commentSelect = {
  id: true,
  postId: true,
  parentId: true,
  body: true,
  status: true,
  createdAt: true,
  authorId: true,
  author: { select: authorSelect },
} satisfies Prisma.CommunityCommentSelect;

export type CommentRow = Prisma.CommunityCommentGetPayload<{
  select: typeof commentSelect;
}>;

export interface AuthorView {
  handle: string | null;
  avatarUrl: string | null;
}

export interface PostView {
  id: string;
  type: string;
  body: string;
  speciesCategory: string | null;
  /** VISIBLE pour tous ; l'auteur voit aussi HIDDEN_AUTO / HIDDEN_MODERATOR. */
  status: string;
  createdAt: Date;
  author: AuthorView;
  animal: { name: string; species: string; scientificName: string } | null;
  media: MediaView[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isMine: boolean;
  helpfulCommentId: string | null;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  status: string;
  createdAt: Date;
  author: AuthorView;
  isMine: boolean;
  isHelpful: boolean;
  replies?: CommentView[];
}

export class CommunityPresenter {
  constructor(private readonly media: CommunityMediaService) {}

  author(user: {
    communityProfile: { handle: string; avatar: { key: string } | null } | null;
  }): AuthorView {
    const p = user.communityProfile;
    return {
      handle: p?.handle ?? null,
      avatarUrl: p?.avatar ? this.media.url(p.avatar.key) : null,
    };
  }

  post(row: PostRow, viewerId: string): PostView {
    return {
      id: row.id,
      type: row.type,
      body: row.body,
      speciesCategory: row.speciesCategory,
      status: row.status,
      createdAt: row.createdAt,
      author: this.author(row.author),
      animal: row.animal
        ? {
            name: row.animal.name,
            species: row.animal.speciesProfile.commonNameFr,
            scientificName: row.animal.speciesProfile.scientificName,
          }
        : null,
      media: row.media.map((m) => this.media.view(m)),
      likeCount: row._count.reactions,
      commentCount: row._count.comments,
      likedByMe: row.reactions.length > 0,
      isMine: row.authorId === viewerId,
      helpfulCommentId: row.helpfulCommentId,
    };
  }

  comment(
    row: CommentRow,
    viewerId: string,
    helpfulCommentId: string | null,
  ): CommentView {
    return {
      id: row.id,
      postId: row.postId,
      parentId: row.parentId,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt,
      author: this.author(row.author),
      isMine: row.authorId === viewerId,
      isHelpful: helpfulCommentId === row.id,
    };
  }
}
