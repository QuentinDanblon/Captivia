/**
 * Messages d'erreur affichés à l'écran : jamais le texte brut de l'API (souvent en anglais, parfois
 * technique), mais une clé i18n choisie selon le code machine (`code`) puis le statut HTTP.
 * Chaque écran peut préciser ses propres clés ; le reste retombe sur les messages génériques
 * du namespace `apiErrors`.
 */
import { ApiError, isBackendUnavailable } from './api';

export interface ErrorKeyMap {
  /** Clé par code machine renvoyé par l'API (`EMAIL_NOT_VERIFIED`…), prioritaire sur le statut. */
  codes?: Record<string, string>;
  /** Clé par statut HTTP (`409` → « e-mail déjà utilisé »…). */
  statuses?: Record<number, string>;
  /** Backend injoignable ou délai dépassé. */
  unavailable?: string;
  /** Tout le reste (5xx, erreur inattendue). */
  fallback?: string;
}

/** Clé i18n du message à afficher pour `err` ; jamais `err.message`. */
export function errorKey(err: unknown, map: ErrorKeyMap = {}): string {
  if (isBackendUnavailable(err)) return map.unavailable ?? 'apiErrors.unavailable';
  if (err instanceof ApiError) {
    const byCode = err.code ? map.codes?.[err.code] : undefined;
    if (byCode) return byCode;
    const byStatus = map.statuses?.[err.status];
    if (byStatus) return byStatus;
    if (err.status === 401) return 'common.sessionExpired';
    if (err.status === 429) return 'apiErrors.tooManyRequests';
    if (err.status === 400 || err.status === 422) return 'apiErrors.invalid';
    if (err.status === 404) return 'apiErrors.notFound';
  }
  return map.fallback ?? 'apiErrors.generic';
}
