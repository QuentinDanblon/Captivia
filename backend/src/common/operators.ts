/**
 * Identification des opérateurs Captivia.
 *
 * Un opérateur est identifié par son adresse email, listée dans la variable
 * d'environnement OPERATOR_EMAILS (liste séparée par des virgules, espaces
 * tolérés). La comparaison est insensible à la casse et aux espaces.
 *
 * Ce module est le point unique de la logique "opérateur" : il est utilisé
 * par AuthService (premium effectif) et par les endpoints d'administration
 * du premium (SubscriptionModule).
 */
const OPERATOR_EMAILS = (process.env.OPERATOR_EMAILS || process.env.OPERATOR_EMAIL || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isOperatorEmail(email?: string | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  return OPERATOR_EMAILS.some((op) => op === normalized);
}
