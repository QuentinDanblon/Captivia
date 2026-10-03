/**
 * Libellés des types de rappel (préférences de notification, rappels du jour). L'API stocke la
 * clé telle quelle : clés historiques (« uvb », « sante »…) ou libellé suggéré en français
 * (« UVB / éclairage »…). L'affichage passe par `notifications.suggested.<id>` dans la langue
 * de l'utilisateur ; un libellé personnalisé reste affiché tel que saisi.
 */
export const REMINDER_TYPE_LABEL_IDS: Readonly<Record<string, string>> = {
  // Clés historiques (anciennes préférences par défaut, types de routine).
  nourrissage: 'feeding',
  nettoyage: 'cleaning',
  entretien: 'cleaning',
  uvb: 'uvb',
  sante: 'health',
  controle: 'health',
  // Sujets suggérés par la page des notifications (identifiants stockés, inchangés).
  Nourrissage: 'feeding',
  Nettoyage: 'cleaning',
  'UVB / éclairage': 'uvb',
  Santé: 'health',
  'Rappel vétérinaire': 'vet',
  Mue: 'shedding',
  Pondération: 'weighing',
  Bain: 'bath',
  Température: 'temperature',
  Humidité: 'humidity',
};

/** Clé i18n du libellé d'un type de rappel connu, sinon `undefined` (libellé personnalisé). */
export function reminderLabelKey(type: string | null | undefined): string | undefined {
  // Propriété propre uniquement : un libellé « toString » ne doit pas lire le prototype.
  const id = type && Object.prototype.hasOwnProperty.call(REMINDER_TYPE_LABEL_IDS, type) ? REMINDER_TYPE_LABEL_IDS[type] : undefined;
  return id ? `notifications.suggested.${id}` : undefined;
}
