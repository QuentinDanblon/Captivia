import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuestAccountException } from '../common/guest';
import {
  COMMUNITY_RULES_VERSION,
  CommunityErrorCode,
} from './community.constants';
import { forbidden, tooMany } from './community.errors';

/** Compte appelant, relu en base (jamais d'e-mail : inutile aux décisions d'accès). */
export interface CommunityActor {
  id: string;
  isGuest: boolean;
  emailVerified: boolean;
  /** Case « 15 ans ou plus » cochée à l'inscription (enregistrée avec l'acceptation des CGU). */
  termsAccepted: boolean;
  createdAt: Date;
  /**
   * Suspension de publication en cours ou passée (portée par le compte : survit au départ de la
   * communauté et à la réactivation du profil). NULL = jamais suspendu ou suspension levée.
   */
  suspendedUntil: Date | null;
  profile: {
    handle: string;
    rulesVersion: string;
  } | null;
}

export type IneligibilityReason =
  | 'GUEST_ACCOUNT'
  | 'EMAIL_NOT_VERIFIED'
  | 'COMMUNITY_PROFILE_REQUIRED'
  | 'COMMUNITY_RULES_NOT_ACCEPTED'
  | 'COMMUNITY_SUSPENDED';

/**
 * Règles d'accès à l'écriture dans la communauté :
 * - lecture, signalement et blocage : tout compte connecté (invité compris) ;
 * - « membre » (j'aime, modification du profil) : compte non invité, e-mail vérifié, profil
 *   activé avec la version courante des règles ;
 * - « auteur » (publication, commentaire, téléversement) : membre non suspendu.
 * Chaque refus est un 403 avec un code explicite (GUEST_ACCOUNT, EMAIL_NOT_VERIFIED,
 * COMMUNITY_PROFILE_REQUIRED, COMMUNITY_RULES_NOT_ACCEPTED, COMMUNITY_SUSPENDED).
 */
@Injectable()
export class CommunityAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async loadActor(userId: string): Promise<CommunityActor> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isGuest: true,
        emailVerifiedAt: true,
        termsAcceptedAt: true,
        createdAt: true,
        communitySuspendedUntil: true,
        communityProfile: { select: { handle: true, rulesVersion: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      isGuest: user.isGuest,
      emailVerified: user.emailVerifiedAt !== null,
      termsAccepted: user.termsAcceptedAt !== null,
      createdAt: user.createdAt,
      suspendedUntil: user.communitySuspendedUntil,
      profile: user.communityProfile,
    };
  }

  /** Motifs (ordonnés) qui empêchent de publier ; vide = publication autorisée. */
  ineligibility(
    actor: CommunityActor,
    now: Date = new Date(),
  ): IneligibilityReason[] {
    const reasons: IneligibilityReason[] = [];
    if (actor.isGuest) reasons.push('GUEST_ACCOUNT');
    if (!actor.isGuest && !actor.emailVerified)
      reasons.push('EMAIL_NOT_VERIFIED');
    if (!actor.profile) reasons.push('COMMUNITY_PROFILE_REQUIRED');
    else if (actor.profile.rulesVersion !== COMMUNITY_RULES_VERSION)
      reasons.push('COMMUNITY_RULES_NOT_ACCEPTED');
    if (isSuspended(actor.suspendedUntil, now))
      reasons.push('COMMUNITY_SUSPENDED');
    return reasons;
  }

  /** Compte vérifié (non invité) : prérequis de l'activation du profil. */
  assertVerifiedAccount(actor: CommunityActor): void {
    if (actor.isGuest) throw new GuestAccountException('publish');
    if (!actor.emailVerified) {
      throw forbidden(
        CommunityErrorCode.EMAIL_NOT_VERIFIED,
        'Verify your email address before joining the community.',
      );
    }
  }

  /** Membre : compte vérifié + profil activé avec les règles en vigueur. */
  async requireMember(userId: string): Promise<CommunityActor> {
    const actor = await this.loadActor(userId);
    this.assertVerifiedAccount(actor);
    if (!actor.profile) {
      throw forbidden(
        CommunityErrorCode.PROFILE_REQUIRED,
        'Activate your community profile first.',
      );
    }
    if (actor.profile.rulesVersion !== COMMUNITY_RULES_VERSION) {
      throw forbidden(
        CommunityErrorCode.RULES_NOT_ACCEPTED,
        'Accept the updated community rules to continue.',
      );
    }
    return actor;
  }

  /** Auteur : membre non suspendu. */
  async requirePublisher(userId: string): Promise<CommunityActor> {
    const actor = await this.requireMember(userId);
    this.assertNotSuspended(actor);
    return actor;
  }

  /** 403 COMMUNITY_SUSPENDED tant qu'une suspension est en cours (profil actif ou non). */
  assertNotSuspended(actor: CommunityActor): void {
    const until = actor.suspendedUntil;
    if (until && isSuspended(until)) {
      throw forbidden(
        CommunityErrorCode.SUSPENDED,
        `Publishing is suspended until ${until.toISOString()}.`,
      );
    }
  }

  /**
   * Limite par compte appliquée de façon atomique : dans une transaction, verrou consultatif
   * propre au compte et à la limite (`pg_advisory_xact_lock`), comptage sur la fenêtre glissante,
   * puis `work` (l'insertion qui sera comptée par les requêtes suivantes). Des requêtes
   * parallèles d'un même compte sont ainsi sérialisées : la limite est respectée strictement,
   * sur plusieurs instances, sans Redis.
   */
  async withRateLimit<T>(
    userId: string,
    scope: 'posts' | 'comments' | 'uploads',
    count: (tx: Prisma.TransactionClient, since: Date) => Promise<number>,
    limit: number,
    windowMs: number,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`community-rate:${scope}:${userId}`}, 0))`,
        );
        const since = new Date(Date.now() - windowMs);
        if ((await count(tx, since)) >= limit)
          throw rateLimited(scope, limit, windowMs);
        return work(tx);
      },
      { maxWait: 15_000, timeout: 20_000 },
    );
  }

  /**
   * Limite par compte sur une fenêtre glissante, comptée en base : fiable sur plusieurs
   * instances, sans Redis. `count` renvoie le nombre d'éléments créés depuis `since`.
   */
  async enforceRate(
    count: (since: Date) => Promise<number>,
    limit: number,
    windowMs: number,
    what: string,
  ): Promise<void> {
    const since = new Date(Date.now() - windowMs);
    if ((await count(since)) >= limit) {
      throw rateLimited(what, limit, windowMs);
    }
  }

  /**
   * Filtre Prisma « auteur visible par `viewerId` » : aucun blocage dans un sens ni dans l'autre,
   * et profil communautaire toujours actif.
   */
  visibleAuthor(viewerId: string): Prisma.UserWhereInput {
    return {
      communityProfile: { isNot: null },
      communityBlocksMade: { none: { blockedId: viewerId } },
      communityBlocksReceived: { none: { blockerId: viewerId } },
    };
  }

  /** Vrai si `a` a bloqué `b` ou `b` a bloqué `a`. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const n = await this.prisma.communityBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return n > 0;
  }
}

function rateLimited(what: string, limit: number, windowMs: number) {
  return tooMany(
    CommunityErrorCode.RATE_LIMITED,
    `Too many ${what}: at most ${limit} per ${Math.round(windowMs / 60000)} min. Try again later.`,
  );
}

export function isSuspended(
  until: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return !!until && until.getTime() > now.getTime();
}
