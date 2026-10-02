/**
 * Erreurs des sections de la fiche animal : jamais le message brut du backend (souvent en anglais,
 * parfois technique) ni un « Erreur » en dur, mais une clé traduite selon le statut HTTP.
 */
import { ApiError, isBackendUnavailable } from '@/lib/api';

/** 403 : fonctionnalité réservée au Premium (la section passe en mode verrouillé). */
export function isPremiumLocked(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

/** Clé i18n du message à afficher dans le formulaire d'une section après un échec d'enregistrement. */
export function sectionErrorKey(err: unknown): string {
  if (isBackendUnavailable(err)) return 'animals.sectionErrors.unavailable';
  if (err instanceof ApiError) {
    if (err.status === 401) return 'common.sessionExpired';
    if (err.status === 400 || err.status === 422) return 'animals.sectionErrors.invalid';
    if (err.status === 404) return 'animals.sectionErrors.notFound';
  }
  return 'animals.sectionErrors.saveFailed';
}
