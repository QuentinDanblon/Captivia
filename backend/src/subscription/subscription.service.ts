import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SubscriptionSource,
  SubscriptionStatus as SubStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePremium, isEntitledSubscription } from '../common/operators';

export type SubscriptionPlan = 'monthly' | 'yearly';

/** Réponse des endpoints d'administration (rétrocompatible). */
export interface SubscriptionStatus {
  isPremium: boolean;
  plan?: SubscriptionPlan;
}

/** GET /users/me/subscription (W6-08). `isPremium`/`plan` conservés pour les anciens clients. */
export interface SubscriptionStatusView extends SubscriptionStatus {
  premium: boolean;
  source: SubscriptionSource | null;
  status: SubStatus | null;
  productId: string | null;
  currentPeriodEnd: Date | null;
  willRenew: boolean;
  manageUrl: string | null;
}

export const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
export const GOOGLE_MANAGE_URL =
  'https://play.google.com/store/account/subscriptions';

/** Lien de gestion de l'abonnement chez le store qui l'a vendu (résiliation, changement d'offre). */
export function manageUrlFor(
  source: SubscriptionSource | null,
  productId: string | null,
): string | null {
  if (source === SubscriptionSource.APPLE) return APPLE_MANAGE_URL;
  if (source === SubscriptionSource.GOOGLE) {
    const pkg = (process.env.GOOGLE_PLAY_PACKAGE_NAME || '').trim();
    if (pkg && productId) {
      // RevenueCat préfixe parfois l'identifiant Play par "<subscriptionId>:<basePlanId>".
      const sku = productId.split(':')[0];
      return `${GOOGLE_MANAGE_URL}?sku=${encodeURIComponent(sku)}&package=${encodeURIComponent(pkg)}`;
    }
    return GOOGLE_MANAGE_URL;
  }
  return null;
}

function planFromProductId(productId: string | null): SubscriptionPlan {
  return productId && /(year|annual|annuel|yearly|p1y)/i.test(productId)
    ? 'yearly'
    : 'monthly';
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(
    userId: string,
    now: Date = new Date(),
  ): Promise<SubscriptionStatusView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isPremium: true,
        role: true,
        subscriptions: {
          select: {
            source: true,
            status: true,
            productId: true,
            currentPeriodEnd: true,
            willRenew: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const premium = effectivePremium(user, now);
    // Abonnement à afficher : celui qui ouvre le droit (échéance la plus lointaine),
    // sinon le plus récemment mis à jour (ex. expiré, problème de facturation).
    const entitled = user.subscriptions
      .filter((s) => isEntitledSubscription(s, now))
      .sort(
        (a, b) =>
          (b.currentPeriodEnd?.getTime() ?? 0) -
          (a.currentPeriodEnd?.getTime() ?? 0),
      );
    const shown = entitled[0] ?? user.subscriptions[0] ?? null;

    if (shown && (entitled.length > 0 || !premium)) {
      return {
        isPremium: premium,
        ...(premium && { plan: planFromProductId(shown.productId) }),
        premium,
        source: shown.source,
        status: shown.status,
        productId: shown.productId,
        currentPeriodEnd: shown.currentPeriodEnd,
        willRenew: shown.willRenew,
        manageUrl: manageUrlFor(shown.source, shown.productId),
      };
    }

    // Premium sans abonnement store : activation manuelle opérateur (ou rôle opérateur).
    return {
      isPremium: premium,
      ...(premium && { plan: 'monthly' as SubscriptionPlan }),
      premium,
      source: premium ? SubscriptionSource.MANUAL : null,
      status: premium ? SubStatus.ACTIVE : null,
      productId: null,
      currentPeriodEnd: null,
      willRenew: false,
      manageUrl: null,
    };
  }

  /**
   * Activation administrative du premium par un opérateur.
   * @param expectedEmail Facultatif : email de confirmation du compte cible (doit correspondre, sinon 400).
   */
  async activatePremium(
    userId: string,
    expectedEmail?: string,
  ): Promise<SubscriptionStatus> {
    return this.setPremium(userId, true, expectedEmail);
  }

  /** Résiliation manuelle du premium par un opérateur. */
  async deactivatePremium(userId: string): Promise<SubscriptionStatus> {
    return this.setPremium(userId, false);
  }

  private async setPremium(
    userId: string,
    isPremium: boolean,
    expectedEmail?: string,
  ): Promise<SubscriptionStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (expectedEmail) {
      const targetEmail = (user.email || '').trim().toLowerCase();
      const providedEmail = expectedEmail.trim().toLowerCase();
      if (providedEmail !== targetEmail) {
        throw new BadRequestException(
          "L'email fourni ne correspond pas au compte cible.",
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isPremium },
      select: { isPremium: true },
    });

    return {
      isPremium: updated.isPremium,
      ...(updated.isPremium && { plan: 'monthly' as SubscriptionPlan }),
    };
  }
}
