/**
 * Masquage des secrets d'URL avant envoi à Sentry.
 *
 * Le lien de réinitialisation de mot de passe porte son jeton dans `?token=…` : sans filtrage, il
 * partirait dans `request.url`, le nom de transaction, les breadcrumbs (navigation / fetch) et les
 * spans. Les fonctions sont génériques (pas de dépendance au SDK) pour rester testables.
 */

export const FILTERED = '[Filtered]';

const TOKEN_PARAM = /([?&#;]|^)(token=)[^&#\s"']*/gi;
const MAX_DEPTH = 8;

/** Remplace la valeur de tout paramètre `token` dans une chaîne contenant une URL ou une query. */
export function scrubTokenInString(value: string): string {
  return value.replace(TOKEN_PARAM, `$1$2${FILTERED}`);
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return scrubTokenInString(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubValue(value[i], depth + 1);
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    // Query sous forme d'objet : { token: '…' }.
    record[key] = key.toLowerCase() === 'token' ? FILTERED : scrubValue(record[key], depth + 1);
  }
  return record;
}

/**
 * Masque (en place) les paramètres `token` d'un événement Sentry : request.url / query_string /
 * headers (Referer), transaction, breadcrumbs, spans, contexts. Retourne l'événement.
 */
export function scrubSentryEvent<T>(event: T): T {
  if (event && typeof event === 'object') {
    scrubValue(event, 0);
  }
  return event;
}
