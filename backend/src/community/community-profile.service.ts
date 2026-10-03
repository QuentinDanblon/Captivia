import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CommunityAccessService,
  isSuspended,
} from './community-access.service';
import {
  COMMUNITY_RULES_VERSION,
  CommunityErrorCode,
} from './community.constants';
import { badRequest, conflict, forbidden, notFound } from './community.errors';
import { CommunityDataService } from './community-data.service';
import { checkHandle, handleKey } from './handle';
import { claimHandle, holdHandle } from './handle-hold';
import { CommunityMediaService } from './media/community-media.service';
import { ActivateProfileDto, UpdateProfileDto } from './dto/community.dto';

const profileSelect = {
  handle: true,
  handleKey: true,
  rulesVersion: true,
  rulesAcceptedAt: true,
  createdAt: true,
  avatar: { select: { key: true } },
} satisfies Prisma.CommunityProfileSelect;

type ProfileRow = Prisma.CommunityProfileGetPayload<{
  select: typeof profileSelect;
}>;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Profil public : activation explicite (règles de communauté acceptées, âge minimal confirmé),
 * pseudo unique, avatar facultatif, départ de la communauté. Jamais d'e-mail exposé.
 */
@Injectable()
export class CommunityProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly media: CommunityMediaService,
    private readonly data: CommunityDataService,
  ) {}

  /** `suspendedUntil` : suspension portée par le compte (User.communitySuspendedUntil). */
  private view(p: ProfileRow, suspendedUntil: Date | null) {
    return {
      handle: p.handle,
      avatarUrl: p.avatar ? this.media.url(p.avatar.key) : null,
      rulesVersion: p.rulesVersion,
      rulesAcceptedAt: p.rulesAcceptedAt,
      suspendedUntil: isSuspended(suspendedUntil) ? suspendedUntil : null,
      createdAt: p.createdAt,
    };
  }

  /** Mon profil (ou null) et ce qui m'empêche éventuellement de publier. */
  async getMe(userId: string) {
    const actor = await this.access.loadActor(userId);
    const profile = await this.prisma.communityProfile.findUnique({
      where: { userId },
      select: profileSelect,
    });
    const reasons = this.access.ineligibility(actor);
    return {
      profile: profile ? this.view(profile, actor.suspendedUntil) : null,
      /**
       * Fin de la suspension de publication en cours (portée par le compte), même sans profil
       * (départ de la communauté puis retour) ; null si aucune suspension active.
       */
      suspendedUntil: isSuspended(actor.suspendedUntil)
        ? actor.suspendedUntil
        : null,
      currentRulesVersion: COMMUNITY_RULES_VERSION,
      canPublish: reasons.length === 0,
      reasons,
      /** Compte antérieur à la case d'âge : `ageConfirmed: true` exigé à l'activation. */
      ageConfirmationRequired: !actor.termsAccepted,
    };
  }

  /**
   * Activation du profil. Refusée (403 COMMUNITY_SUSPENDED) tant qu'une suspension de publication
   * est en cours : la suspension est portée par le compte, quitter la communauté puis revenir ne
   * la lève pas. Un pseudo réservé à un autre compte (libéré depuis moins de 60 jours) : 409.
   */
  async activate(userId: string, dto: ActivateProfileDto) {
    const actor = await this.access.loadActor(userId);
    this.access.assertVerifiedAccount(actor);
    if (actor.profile) {
      throw conflict(
        CommunityErrorCode.PROFILE_EXISTS,
        'Your community profile is already active.',
      );
    }
    this.access.assertNotSuspended(actor);
    if (dto.rulesVersion !== COMMUNITY_RULES_VERSION) {
      throw badRequest(
        CommunityErrorCode.RULES_VERSION_MISMATCH,
        `The current community rules version is ${COMMUNITY_RULES_VERSION}.`,
      );
    }
    // Âge minimal (CGU) : la case « 15 ans ou plus » est obligatoire à l'inscription et enregistrée
    // avec l'acceptation des CGU (termsAcceptedAt). Un compte antérieur la confirme ici.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { termsAcceptedAt: true },
    });
    if (!user?.termsAcceptedAt && dto.ageConfirmed !== true) {
      throw forbidden(
        CommunityErrorCode.AGE_CONFIRMATION_REQUIRED,
        'Confirm that you are at least 15 years old to join the community.',
      );
    }
    const handle = this.checkedHandle(dto.handle);
    const now = new Date();
    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        await claimHandle(tx, handle.key, userId, now);
        return tx.communityProfile.create({
          data: {
            userId,
            handle: handle.handle,
            handleKey: handle.key,
            rulesVersion: COMMUNITY_RULES_VERSION,
            rulesAcceptedAt: now,
            ageConfirmedAt: user?.termsAcceptedAt ?? now,
          },
          select: profileSelect,
        });
      });
      return this.view(profile, actor.suspendedUntil);
    } catch (error) {
      if (isUniqueViolation(error)) this.handleTaken(error);
      throw error;
    }
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const actor = await this.access.loadActor(userId);
    this.access.assertVerifiedAccount(actor);
    if (!actor.profile) {
      throw forbidden(
        CommunityErrorCode.PROFILE_REQUIRED,
        'Activate your community profile first.',
      );
    }
    const data: Prisma.CommunityProfileUncheckedUpdateInput = {};
    let rulesVersion = actor.profile.rulesVersion;
    if (dto.acceptRulesVersion !== undefined) {
      if (dto.acceptRulesVersion !== COMMUNITY_RULES_VERSION) {
        throw badRequest(
          CommunityErrorCode.RULES_VERSION_MISMATCH,
          `The current community rules version is ${COMMUNITY_RULES_VERSION}.`,
        );
      }
      data.rulesVersion = COMMUNITY_RULES_VERSION;
      data.rulesAcceptedAt = new Date();
      rulesVersion = COMMUNITY_RULES_VERSION;
    }
    const changesIdentity =
      dto.handle !== undefined || dto.avatarMediaId !== undefined;
    if (changesIdentity && rulesVersion !== COMMUNITY_RULES_VERSION) {
      throw forbidden(
        CommunityErrorCode.RULES_NOT_ACCEPTED,
        'Accept the updated community rules to continue.',
      );
    }
    if (changesIdentity && isSuspended(actor.suspendedUntil)) {
      throw forbidden(
        CommunityErrorCode.SUSPENDED,
        'Your profile cannot be changed while publishing is suspended.',
      );
    }
    if (dto.handle !== undefined) {
      const handle = this.checkedHandle(dto.handle);
      data.handle = handle.handle;
      data.handleKey = handle.key;
    }

    const current = await this.prisma.communityProfile.findUnique({
      where: { userId },
      select: { handleKey: true, avatar: { select: { id: true, key: true } } },
    });
    let oldAvatarKey: string | null = null;
    if (dto.avatarMediaId !== undefined) {
      if (dto.avatarMediaId !== null) {
        const media = await this.prisma.communityMedia.findFirst({
          where: {
            id: dto.avatarMediaId,
            ownerId: userId,
            postId: null,
            avatarOf: { is: null },
          },
          select: { id: true },
        });
        if (!media) {
          throw badRequest(
            CommunityErrorCode.INVALID_MEDIA,
            'Unknown or already used image.',
          );
        }
      }
      if (current?.avatar && current.avatar.id !== dto.avatarMediaId) {
        oldAvatarKey = current.avatar.key;
      }
      data.avatarMediaId = dto.avatarMediaId;
    }

    try {
      const now = new Date();
      const newKey = typeof data.handleKey === 'string' ? data.handleKey : null;
      const oldKey = current?.handleKey ?? null;
      const profile = await this.prisma.$transaction(async (tx) => {
        if (newKey && newKey !== oldKey) {
          await claimHandle(tx, newKey, userId, now);
        }
        const updated = await tx.communityProfile.update({
          where: { userId },
          data,
          select: profileSelect,
        });
        // L'ancien pseudo reste réservé 60 jours à son titulaire (anti-usurpation).
        if (newKey && oldKey && newKey !== oldKey) {
          await holdHandle(tx, oldKey, userId, now);
        }
        return updated;
      });
      if (oldAvatarKey) await this.media.purgeKeys([oldAvatarKey]);
      return this.view(profile, actor.suspendedUntil);
    } catch (error) {
      if (isUniqueViolation(error)) this.handleTaken(error);
      throw error;
    }
  }

  /**
   * Départ de la communauté : profil, publications, commentaires, réactions, images supprimés.
   * Toujours permis (droit de partir), y compris pendant une suspension, qui reste attachée au
   * compte et s'appliquera à une éventuelle réactivation. Le pseudo reste réservé 60 jours.
   */
  async deactivate(userId: string): Promise<void> {
    const actor = await this.access.loadActor(userId);
    if (!actor.profile) throw notFound();
    await this.data.leaveCommunity(userId);
  }

  /** Profil public d'un membre (pseudo, avatar, ancienneté, nombre de publications visibles). */
  async getPublic(viewerId: string, handle: string) {
    await this.access.loadActor(viewerId);
    const profile = await this.prisma.communityProfile.findUnique({
      where: { handleKey: handleKey(handle) },
      select: { userId: true, ...profileSelect },
    });
    if (
      !profile ||
      (await this.access.isBlockedEitherWay(viewerId, profile.userId))
    ) {
      throw notFound();
    }
    const isMe = profile.userId === viewerId;
    const postCount = await this.prisma.communityPost.count({
      where: {
        authorId: profile.userId,
        ...(isMe ? {} : { status: 'VISIBLE' }),
      },
    });
    return {
      handle: profile.handle,
      avatarUrl: profile.avatar ? this.media.url(profile.avatar.key) : null,
      memberSince: profile.createdAt,
      postCount,
      isMe,
    };
  }

  // ---------------------------------------------------------------------------
  // Blocages
  // ---------------------------------------------------------------------------

  async listBlocks(userId: string) {
    await this.access.loadActor(userId);
    const rows = await this.prisma.communityBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        blocked: {
          select: {
            communityProfile: {
              select: { handle: true, avatar: { select: { key: true } } },
            },
          },
        },
      },
    });
    return {
      items: rows
        .filter((r) => r.blocked.communityProfile)
        .map((r) => ({
          handle: r.blocked.communityProfile!.handle,
          avatarUrl: r.blocked.communityProfile!.avatar
            ? this.media.url(r.blocked.communityProfile!.avatar.key)
            : null,
          blockedAt: r.createdAt,
        })),
    };
  }

  /** Blocage idempotent d'un membre par son pseudo (tout compte connecté). */
  async block(userId: string, handle: string) {
    await this.access.loadActor(userId);
    const target = await this.prisma.communityProfile.findUnique({
      where: { handleKey: handleKey(handle) },
      select: { userId: true, handle: true },
    });
    if (!target) throw notFound();
    if (target.userId === userId) {
      throw badRequest(
        CommunityErrorCode.CANNOT_BLOCK_SELF,
        'You cannot block yourself.',
      );
    }
    await this.prisma.communityBlock.createMany({
      data: [{ blockerId: userId, blockedId: target.userId }],
      skipDuplicates: true,
    });
    return { handle: target.handle, blocked: true };
  }

  async unblock(userId: string, handle: string) {
    await this.access.loadActor(userId);
    const target = await this.prisma.communityProfile.findUnique({
      where: { handleKey: handleKey(handle) },
      select: { userId: true, handle: true },
    });
    if (!target) throw notFound();
    await this.prisma.communityBlock.deleteMany({
      where: { blockerId: userId, blockedId: target.userId },
    });
    return { handle: target.handle, blocked: false };
  }

  // ---------------------------------------------------------------------------

  private checkedHandle(raw: string) {
    const res = checkHandle(raw);
    if (!res.ok) {
      throw res.reason === 'reserved'
        ? badRequest(
            CommunityErrorCode.HANDLE_RESERVED,
            'This handle is reserved.',
          )
        : badRequest(
            CommunityErrorCode.HANDLE_INVALID,
            'Handle: 3 to 30 characters, letters, digits, "_" or "." (not at the start or end).',
          );
    }
    return res;
  }

  private handleTaken(error: unknown): never {
    const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
    const fields = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';
    if (fields.includes('userId')) {
      throw conflict(
        CommunityErrorCode.PROFILE_EXISTS,
        'Your community profile is already active.',
      );
    }
    if (fields.includes('avatarMediaId')) {
      throw badRequest(
        CommunityErrorCode.INVALID_MEDIA,
        'Unknown or already used image.',
      );
    }
    throw conflict(
      CommunityErrorCode.HANDLE_TAKEN,
      'This handle is already taken.',
    );
  }
}
