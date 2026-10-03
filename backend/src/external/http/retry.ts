/**
 * Backoff exponentiel avec « jitter équilibré » : le délai est tiré uniformément dans
 * [cap/2, cap] où cap = min(maxDelay, base * 2^(n-1)). Le jitter évite que toutes les
 * instances ne réessaient au même instant après une panne du fournisseur.
 *
 * @param retryNumber numéro du réessai (1 = premier réessai)
 * @param random      source d'aléa dans [0, 1[ (injectable pour les tests)
 */
export function computeBackoffDelay(
  retryNumber: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, retryNumber - 1);
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
  const r = Math.min(Math.max(random(), 0), 1);
  return Math.round(cap / 2 + (r * cap) / 2);
}

/** Valeur de l'en-tête Retry-After (secondes ou date HTTP) en millisecondes, sinon null. */
export function parseRetryAfterMs(
  value: unknown,
  now: number = Date.now(),
): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const date = Date.parse(raw);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}
