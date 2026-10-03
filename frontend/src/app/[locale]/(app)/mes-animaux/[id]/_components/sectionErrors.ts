/**
 * Erreurs des sections de la fiche animal : jamais le message brut du backend (souvent en anglais,
 * parfois technique) ni un « Erreur » en dur, mais une clé traduite selon le statut HTTP.
 */
import { ApiError } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';

/** 403 : fonctionnalité réservée au Premium (la section passe en mode verrouillé). */
export function isPremiumLocked(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

/** Clé i18n du message à afficher dans le formulaire d'une section après un échec d'enregistrement. */
export function sectionErrorKey(err: unknown): string {
  return errorKey(err, {
    statuses: {
      400: 'animals.sectionErrors.invalid',
      422: 'animals.sectionErrors.invalid',
      404: 'animals.sectionErrors.notFound',
    },
    unavailable: 'animals.sectionErrors.unavailable',
    fallback: 'animals.sectionErrors.saveFailed',
  });
}
