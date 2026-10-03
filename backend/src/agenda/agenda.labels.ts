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
      changement_eau: 'Changement d’eau',
      nettoyage_habitat: 'Nettoyage de l’habitat',
      litiere: 'Litière',
      promenade: 'Promenade',
      exercice: 'Exercice',
      brossage: 'Brossage',
      hygiene: 'Hygiène',
      entrainement: 'Entraînement',
      controle_materiel: 'Contrôle du matériel',
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
      changement_eau: 'Water change',
      nettoyage_habitat: 'Habitat cleaning',
      litiere: 'Litter care',
      promenade: 'Walk',
      exercice: 'Exercise',
      brossage: 'Brushing',
      hygiene: 'Hygiene',
      entrainement: 'Training',
      controle_materiel: 'Equipment check',
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
      changement_eau: 'Wasserwechsel',
      nettoyage_habitat: 'Reinigung des Lebensraums',
      litiere: 'Streu',
      promenade: 'Spaziergang',
      exercice: 'Bewegung',
      brossage: 'Bürsten',
      hygiene: 'Hygiene',
      entrainement: 'Training',
      controle_materiel: 'Ausrüstungskontrolle',
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
      changement_eau: 'Cambio de agua',
      nettoyage_habitat: 'Limpieza del hábitat',
      litiere: 'Arena',
      promenade: 'Paseo',
      exercice: 'Ejercicio',
      brossage: 'Cepillado',
      hygiene: 'Higiene',
      entrainement: 'Entrenamiento',
      controle_materiel: 'Revisión del material',
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
      changement_eau: 'Cambio dell’acqua',
      nettoyage_habitat: 'Pulizia dell’habitat',
      litiere: 'Lettiera',
      promenade: 'Passeggiata',
      exercice: 'Attività fisica',
      brossage: 'Spazzolatura',
      hygiene: 'Igiene',
      entrainement: 'Addestramento',
      controle_materiel: 'Controllo dell’attrezzatura',
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
      changement_eau: 'Mudança da água',
      nettoyage_habitat: 'Limpeza do habitat',
      litiere: 'Areia',
      promenade: 'Passeio',
      exercice: 'Exercício',
      brossage: 'Escovagem',
      hygiene: 'Higiene',
      entrainement: 'Treino',
      controle_materiel: 'Verificação do equipamento',
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
