import { agendaLabels, type AgendaLocale } from '../agenda/agenda.labels';

/**
 * Libellés des rappels générés côté serveur (`NotificationEvent.label`), dans la langue du compte
 * (`User.locale`) : ce texte part tel quel en notification push et en e-mail, et s'affiche dans
 * la page des rappels du jour. Aucun émoji, aucune clé technique (« uvb », « sante ») : les
 * libellés réutilisent ceux de l'Agenda (`agendaLabels`) et des sujets suggérés de l'app.
 */

/** Sujets de rappel connus → libellé par langue (mêmes textes que `notifications.suggested.*`). */
const TYPE_LABELS: Record<string, Record<AgendaLocale, string>> = {
  feeding: {
    fr: 'Nourrissage',
    en: 'Feeding',
    de: 'Fütterung',
    es: 'Alimentación',
    it: 'Alimentazione',
    pt: 'Alimentação',
  },
  cleaning: {
    fr: 'Nettoyage',
    en: 'Cleaning',
    de: 'Reinigung',
    es: 'Limpieza',
    it: 'Pulizia',
    pt: 'Limpeza',
  },
  uvb: {
    fr: 'UVB / éclairage',
    en: 'UVB / lighting',
    de: 'UVB / Beleuchtung',
    es: 'UVB / iluminación',
    it: 'UVB / illuminazione',
    pt: 'UVB / iluminação',
  },
  health: {
    fr: 'Santé',
    en: 'Health',
    de: 'Gesundheit',
    es: 'Salud',
    it: 'Salute',
    pt: 'Saúde',
  },
  vet: {
    fr: 'Rappel vétérinaire',
    en: 'Vet reminder',
    de: 'Tierarzt-Erinnerung',
    es: 'Recordatorio del veterinario',
    it: 'Promemoria veterinario',
    pt: 'Lembrete do veterinário',
  },
  shedding: {
    fr: 'Mue',
    en: 'Shedding',
    de: 'Häutung',
    es: 'Muda',
    it: 'Muta',
    pt: 'Muda',
  },
  weighing: {
    fr: 'Pesée',
    en: 'Weigh-in',
    de: 'Wiegen',
    es: 'Pesaje',
    it: 'Pesata',
    pt: 'Pesagem',
  },
  bath: {
    fr: 'Bain',
    en: 'Bath',
    de: 'Bad',
    es: 'Baño',
    it: 'Bagno',
    pt: 'Banho',
  },
  temperature: {
    fr: 'Température',
    en: 'Temperature',
    de: 'Temperatur',
    es: 'Temperatura',
    it: 'Temperatura',
    pt: 'Temperatura',
  },
  humidity: {
    fr: 'Humidité',
    en: 'Humidity',
    de: 'Luftfeuchtigkeit',
    es: 'Humedad',
    it: 'Umidità',
    pt: 'Humidade',
  },
};

/**
 * Clés stockées dans les préférences (`NotificationPreference.types`) → sujet connu : anciennes
 * clés par défaut (« nourrissage », « uvb », « sante »…) et libellés suggérés enregistrés en
 * français par l'app (« UVB / éclairage »…). Un libellé personnalisé reste affiché tel quel.
 */
const TYPE_KEY_TO_ID: Record<string, string> = {
  nourrissage: 'feeding',
  nettoyage: 'cleaning',
  entretien: 'cleaning',
  uvb: 'uvb',
  sante: 'health',
  controle: 'health',
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

function localeOf(locale: string | null | undefined): AgendaLocale {
  const base = (locale ?? 'fr').toLowerCase().slice(0, 2);
  return (['fr', 'en', 'de', 'es', 'it', 'pt'] as const).includes(
    base as AgendaLocale,
  )
    ? (base as AgendaLocale)
    : 'fr';
}

/** « Libellé : détail » (espace avant les deux-points en français). */
function withDetail(locale: AgendaLocale, label: string, detail: string) {
  return `${label}${locale === 'fr' ? ' : ' : ': '}${detail}`;
}

/** Libellé lisible d'un type de rappel des préférences (clé connue traduite, sinon inchangé). */
export function reminderTypeLabel(
  type: string,
  locale: string | null | undefined,
): string {
  // Propriété propre uniquement : un libellé saisi « toString » ne doit pas lire le prototype.
  const id = Object.prototype.hasOwnProperty.call(TYPE_KEY_TO_ID, type)
    ? TYPE_KEY_TO_ID[type]
    : undefined;
  return id ? TYPE_LABELS[id][localeOf(locale)] : type;
}

/** Jour du rendez-vous vétérinaire (rappel de 08:00). */
export function vetAppointmentLabel(
  vetName: string,
  locale: string | null | undefined,
): string {
  const l = localeOf(locale);
  const today = {
    fr: "aujourd'hui",
    en: 'today',
    de: 'heute',
    es: 'hoy',
    it: 'oggi',
    pt: 'hoje',
  }[l];
  return withDetail(
    l,
    `${agendaLabels(l).itemTypes.vet_appointment} ${today}`,
    vetName,
  );
}

/** Rappel J-N d'un rendez-vous vétérinaire (« demain », « dans 7 jours »). */
export function vetReminderLabel(
  vetName: string,
  daysBefore: number,
  locale: string | null | undefined,
): string {
  const l = localeOf(locale);
  if (daysBefore <= 0) return vetAppointmentLabel(vetName, l);
  const when =
    daysBefore === 1
      ? {
          fr: 'demain',
          en: 'tomorrow',
          de: 'morgen',
          es: 'mañana',
          it: 'domani',
          pt: 'amanhã',
        }[l]
      : {
          fr: `dans ${daysBefore} jours`,
          en: `in ${daysBefore} days`,
          de: `in ${daysBefore} Tagen`,
          es: `dentro de ${daysBefore} días`,
          it: `tra ${daysBefore} giorni`,
          pt: `daqui a ${daysBefore} dias`,
        }[l];
  return withDetail(
    l,
    `${agendaLabels(l).itemTypes.vet_appointment} ${when}`,
    vetName,
  );
}

/** Rappel de vaccin à faire ce jour. */
export function vaccineDueLabel(
  vaccineName: string,
  locale: string | null | undefined,
): string {
  const l = localeOf(locale);
  return withDetail(l, agendaLabels(l).itemTypes.vaccination, vaccineName);
}

/** Prise de médicament : nom, dose ET unité (« Métacam (0,5 ml) »), comme l'Agenda. */
export function medicationLabel(med: {
  name: string;
  dose: string;
  unit?: string | null;
}): string {
  return `${med.name} (${med.dose}${med.unit ? ` ${med.unit}` : ''})`;
}

/** Routine sans nom : type traduit (« Nourrissage », « Feeding »…). */
export function routineLabel(
  routine: { name?: string | null; type: string },
  locale: string | null | undefined,
): string {
  return (
    routine.name ||
    agendaLabels(localeOf(locale)).routineTypes[routine.type] ||
    routine.type
  );
}
