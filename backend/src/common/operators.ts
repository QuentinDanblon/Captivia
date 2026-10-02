import { UserRole } from '@prisma/client';

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

/**
 * Premium effectif : abonnement actif OU opérateur (rôle en base).
 * À utiliser partout où l'on calcule le statut premium d'un utilisateur.
 */
export function effectivePremium(user: {
  isPremium: boolean;
  role?: string | null;
}): boolean {
  return user.isPremium === true || isOperator(user);
}

/** True si l'ancienne variable OPERATOR_EMAILS / OPERATOR_EMAIL est encore définie. */
export function hasLegacyOperatorEmailsEnv(): boolean {
  return Boolean(
    (process.env.OPERATOR_EMAILS || '').trim() ||
    (process.env.OPERATOR_EMAIL || '').trim(),
  );
}
