import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePremium } from '../common/operators';

export type SubscriptionPlan = 'monthly' | 'yearly';

export interface SubscriptionStatus {
  isPremium: boolean;
  plan?: SubscriptionPlan;
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<SubscriptionStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isPremium = effectivePremium(user);
    return {
      isPremium,
      ...(isPremium && { plan: 'monthly' as SubscriptionPlan }), // default display; could store plan in DB later
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
