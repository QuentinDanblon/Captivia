/**
 * Valeurs des formulaires de la fiche animal (fonctions pures, testées) : les champs sont gardés
 * en chaîne pendant la saisie et convertis à l'enregistrement, avec les bornes des DTO backend.
 */

/** Intervalle « toutes les X heures » : entier de 1 à 24, sinon `null`. */
export function parseIntervalHours(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= 24 ? value : null;
}

/**
 * Nombre décimal saisi au clavier français ou anglais (« 4,25 » ou « 4.25 ») : `null` si le champ
 * est vide, `NaN` s'il est illisible.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  return /^\d*\.?\d+$|^\d+\.$/.test(trimmed) ? Number(trimmed) : NaN;
}

/** Nombre de petits (DTO : entier de 0 à 100), sinon `null`. */
export const MAX_OFFSPRING_COUNT = 100;
export function parseOffspringCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_OFFSPRING_COUNT ? value : null;
}

/**
 * Champ texte facultatif : vidé en modification → `null` (l'API efface la valeur) ; vide à la
 * création → `undefined` (champ omis).
 */
export function optionalText(value: string, editing: boolean): string | null | undefined {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  return editing ? null : undefined;
}

/** Écart de pesée suspect (facteur 10 ou plus avec la pesée précédente) : faute de frappe probable. */
export function isSuspiciousChange(previous: number | null | undefined, next: number | null | undefined): boolean {
  if (!previous || !next || previous <= 0 || next <= 0) return false;
  return next / previous >= 10 || previous / next >= 10;
}
