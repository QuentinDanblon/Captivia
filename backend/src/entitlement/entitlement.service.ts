import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { activeSubscriptionWhere } from '../common/operators';

type PrismaClientLike = Pick<PrismaService, 'user'> | Prisma.TransactionClient;

/**
 * Droits premium (W6-08) — point unique de calcul à partir d'un userId.
 * Premium = rôle OPERATOR OU `User.isPremium` (activation manuelle opérateur)
 * OU abonnement store ACTIVE / IN_GRACE_PERIOD / CANCELLED dont l'échéance est future.
 * Même règle que `effectivePremium` (common/operators) quand l'utilisateur est déjà chargé.
 */
@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Une seule requête SQL (EXISTS sur Subscription). `client` permet de l'exécuter
   * dans une transaction interactive en cours (ex. création d'animal sous verrou).
   */
  async isPremium(
    userId: string,
    client: PrismaClientLike = this.prisma,
    now: Date = new Date(),
  ): Promise<boolean> {
    const hit = await client.user.findFirst({
      where: {
        id: userId,
        OR: [
          { role: UserRole.OPERATOR },
          { isPremium: true },
          { subscriptions: { some: activeSubscriptionWhere(now) } },
        ],
      },
      select: { id: true },
    });
    return hit !== null;
  }
}
