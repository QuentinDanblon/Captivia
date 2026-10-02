import { Prisma, SubscriptionStatus, UserRole } from '@prisma/client';

/**
 * Identification des opérateurs Captivia (W0-01).
 *
 * Un opérateur est un utilisateur dont `User.role === OPERATOR`. Ce rôle ne
 * s'obtient JAMAIS par inscription : il est attribué uniquement par la CLI
 * `npm run operator:set -- <email>` (backend/scripts/set-operator.ts).
 *
 * L'ancienne variable d'environnement OPERATOR_EMAILS (comparaison d'email)
 * n'accorde plus aucun droit : elle permettait à quiconque de s'inscrire avec
 * l'email d'un opérateur (aucune vérification de possession de l'email,
 * comparaison sensible à la casse côté base) et d'obtenir les droits associés.
 *
 * Ce module est le point unique de la logique "opérateur" / "premium effectif".
 */
export function isOperator(user?: { role?: string | null } | null): boolean {
  return user?.role === UserRole.OPERATOR;
}

/** Statuts d'abonnement store qui donnent encore accès au premium (jusqu'à currentPeriodEnd). */
export const ENTITLED_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.IN_GRACE_PERIOD,
  SubscriptionStatus.CANCELLED,
];

/**
 * Filtre Prisma des abonnements store qui ouvrent le premium à l'instant `now` :
 * statut ACTIVE / IN_GRACE_PERIOD / CANCELLED (résilié mais payé jusqu'à l'échéance)
 * ET currentPeriodEnd strictement dans le futur.
 */
export function activeSubscriptionWhere(
  now: Date = new Date(),
): Prisma.SubscriptionWhereInput {
  return {
    status: { in: [...ENTITLED_SUBSCRIPTION_STATUSES] },
    currentPeriodEnd: { gt: now },
  };
}

/** Sélection Prisma à inclure sur `user` pour pouvoir appeler `effectivePremium` sans requête de plus. */
export function entitledSubscriptionsSelect(now: Date = new Date()) {
  return {
    where: activeSubscriptionWhere(now),
    select: { status: true, currentPeriodEnd: true },
    take: 1,
  } satisfies Prisma.User$subscriptionsArgs;
}

export function isEntitledSubscription(
  sub: { status: string; currentPeriodEnd: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
      sub.status,
    ) &&
    sub.currentPeriodEnd !== null &&
    sub.currentPeriodEnd.getTime() > now.getTime()
  );
}

/**
 * Premium effectif (W6-08) : rôle OPERATOR OU activation manuelle (`User.isPremium`)
 * OU abonnement store ACTIVE / IN_GRACE_PERIOD / CANCELLED non échu.
 * `subscriptions` : abonnements chargés avec `entitledSubscriptionsSelect()` (ou tous) ;
 * absent = pas d'abonnement store connu. Pour un simple userId, utiliser
 * `EntitlementService.isPremium(userId)` (requête unique).
 */
export function effectivePremium(
  user: {
    isPremium: boolean;
    role?: string | null;
    subscriptions?: {
      status: string;
      currentPeriodEnd: Date | null;
    }[];
  },
  now: Date = new Date(),
): boolean {
  return (
    user.isPremium === true ||
    isOperator(user) ||
    (user.subscriptions ?? []).some((s) => isEntitledSubscription(s, now))
  );
}

/** True si l'ancienne variable OPERATOR_EMAILS / OPERATOR_EMAIL est encore définie. */
export function hasLegacyOperatorEmailsEnv(): boolean {
  return Boolean(
    (process.env.OPERATOR_EMAILS || '').trim() ||
    (process.env.OPERATOR_EMAIL || '').trim(),
  );
}
