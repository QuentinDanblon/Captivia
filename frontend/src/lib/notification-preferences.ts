/**
 * Préférences de notification : contrôles faits AVANT l'envoi à l'API, avec les mêmes bornes que
 * le DTO backend (`UpdateNotificationPreferencesDto`). Un réglage incomplet (heure effacée, date
 * manquante, nom trop long, délai de report vide) n'est jamais envoyé : la page affiche un
 * message traduit au lieu du 400 (ou du 500) de l'API.
 */

/** Longueur maximale du nom d'un rappel (clé de `types`, `MAX_TYPE_KEY_LENGTH` côté API). */
export const MAX_REMINDER_LABEL_LENGTH = 60;
/** Délai de report proposé par la page (minutes). */
export const SNOOZE_MIN = 5;
export const SNOOZE_MAX = 120;
/** Bornes acceptées par l'API (une valeur déjà enregistrée hors de 5–120 reste envoyable). */
const API_SNOOZE_MAX = 1440;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface ScheduleToCheck {
  time?: string;
  recurrence?: string;
  date?: string;
  intervalHours?: number;
  dayOfMonth?: number;
}

export interface PreferencesToCheck {
  types?: Record<string, boolean>;
  typeSchedules?: Record<string, ScheduleToCheck>;
  snooze?: unknown;
}

/** Délai de report saisi (chaîne du champ) → minutes, ou `null` s'il est vide ou hors bornes. */
export function parseSnooze(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= SNOOZE_MIN && value <= SNOOZE_MAX ? value : null;
}

/** Clé i18n du premier problème trouvé, ou `null` si les préférences peuvent être envoyées. */
export function preferencesErrorKey(prefs: PreferencesToCheck): string | null {
  const labels = new Set([...Object.keys(prefs.types ?? {}), ...Object.keys(prefs.typeSchedules ?? {})]);
  for (const label of labels) {
    if (!label.trim() || label.length > MAX_REMINDER_LABEL_LENGTH) return 'notifications.labelTooLong';
  }
  for (const schedule of Object.values(prefs.typeSchedules ?? {})) {
    if (!schedule.time || !TIME_REGEX.test(schedule.time)) return 'notifications.timeRequired';
    if (schedule.recurrence === 'once' && (!schedule.date || !DATE_REGEX.test(schedule.date))) {
      return 'notifications.dateRequired';
    }
  }
  const { snooze } = prefs;
  if (
    snooze !== undefined &&
    (typeof snooze !== 'number' || !Number.isInteger(snooze) || snooze < 0 || snooze > API_SNOOZE_MAX)
  ) {
    return 'notifications.snoozeInvalid';
  }
  return null;
}
