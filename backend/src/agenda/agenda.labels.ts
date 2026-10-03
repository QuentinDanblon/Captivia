/**
 * Libellés serveur de l'Agenda des soins (6 langues de l'application). Utilisés pour le titre par
 * défaut d'une routine sans nom et pour le flux iCalendar (où le client web n'intervient pas).
 * La page web localise ses propres libellés via next-intl.
 */
export type AgendaLocale = 'fr' | 'en' | 'de' | 'es' | 'it' | 'pt';

export interface AgendaLabels {
  routineTypes: Record<string, string>;
  itemTypes: Record<
    'routine' | 'medication' | 'vaccination' | 'vet_appointment',
    string
  >;
  calendarName: string;
  calendarDescription: string;
}

const LABELS: Record<AgendaLocale, AgendaLabels> = {
  fr: {
    routineTypes: {
      nourrissage: 'Nourrissage',
      entretien: 'Entretien',
      uvb: 'UVB / éclairage',
      controle: 'Contrôle santé',
    },
    itemTypes: {
      routine: 'Routine',
      medication: 'Médicament',
      vaccination: 'Rappel de vaccin',
      vet_appointment: 'Rendez-vous vétérinaire',
    },
    calendarName: 'Captivia - Agenda des soins',
    calendarDescription:
      'Soins à venir de vos animaux (routines, médicaments, vaccins, rendez-vous vétérinaires).',
  },
  en: {
    routineTypes: {
      nourrissage: 'Feeding',
      entretien: 'Cleaning',
      uvb: 'UVB / lighting',
      controle: 'Health check',
    },
    itemTypes: {
      routine: 'Routine',
      medication: 'Medication',
      vaccination: 'Vaccine booster',
      vet_appointment: 'Vet appointment',
    },
    calendarName: 'Captivia - Care agenda',
    calendarDescription:
      'Upcoming care for your animals (routines, medications, vaccines, vet appointments).',
  },
  de: {
    routineTypes: {
      nourrissage: 'Fütterung',
      entretien: 'Reinigung',
      uvb: 'UVB / Beleuchtung',
      controle: 'Gesundheitscheck',
    },
    itemTypes: {
      routine: 'Routine',
      medication: 'Medikament',
      vaccination: 'Impferinnerung',
      vet_appointment: 'Tierarzttermin',
    },
    calendarName: 'Captivia - Pflegekalender',
    calendarDescription:
      'Anstehende Pflege Ihrer Tiere (Routinen, Medikamente, Impfungen, Tierarzttermine).',
  },
  es: {
    routineTypes: {
      nourrissage: 'Alimentación',
      entretien: 'Limpieza',
      uvb: 'UVB / iluminación',
      controle: 'Control de salud',
    },
    itemTypes: {
      routine: 'Rutina',
      medication: 'Medicamento',
      vaccination: 'Recordatorio de vacuna',
      vet_appointment: 'Cita veterinaria',
    },
    calendarName: 'Captivia - Agenda de cuidados',
    calendarDescription:
      'Próximos cuidados de tus animales (rutinas, medicamentos, vacunas, citas veterinarias).',
  },
  it: {
    routineTypes: {
      nourrissage: 'Alimentazione',
      entretien: 'Pulizia',
      uvb: 'UVB / illuminazione',
      controle: 'Controllo salute',
    },
    itemTypes: {
      routine: 'Routine',
      medication: 'Farmaco',
      vaccination: 'Richiamo vaccino',
      vet_appointment: 'Appuntamento veterinario',
    },
    calendarName: 'Captivia - Agenda delle cure',
    calendarDescription:
      'Prossime cure dei tuoi animali (routine, farmaci, vaccini, appuntamenti veterinari).',
  },
  pt: {
    routineTypes: {
      nourrissage: 'Alimentação',
      entretien: 'Limpeza',
      uvb: 'UVB / iluminação',
      controle: 'Controlo de saúde',
    },
    itemTypes: {
      routine: 'Rotina',
      medication: 'Medicamento',
      vaccination: 'Lembrete de vacina',
      vet_appointment: 'Consulta veterinária',
    },
    calendarName: 'Captivia - Agenda de cuidados',
    calendarDescription:
      'Próximos cuidados dos seus animais (rotinas, medicamentos, vacinas, consultas veterinárias).',
  },
};

export function agendaLabels(locale: string | null | undefined): AgendaLabels {
  const base = (locale ?? 'fr').toLowerCase().slice(0, 2) as AgendaLocale;
  return LABELS[base] ?? LABELS.fr;
}
