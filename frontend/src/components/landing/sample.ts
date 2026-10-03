/**
 * Données d'exemple des aperçus de la landing : trois animaux fictifs (Moka, chat ; Pixel, gecko
 * léopard ; Fleur, lapine) et une journée fixe. Dates fixes et fuseau UTC : le rendu serveur et
 * l'hydratation affichent exactement la même chose, et les captures restent stables.
 */
import type { CareStatus } from '@/components/ui';

export const SAMPLE_TIME_ZONE = 'UTC';

/** « Aujourd'hui » des aperçus (un vendredi). */
export const SAMPLE_TODAY = '2026-10-02';

export const SAMPLE_ANIMALS = { cat: 'Moka', gecko: 'Pixel', rabbit: 'Fleur' } as const;

type CareKey = 'deworm' | 'feed' | 'terrarium' | 'weigh' | 'hay' | 'vet' | 'molt';
type KindKey = 'medication' | 'feeding' | 'cleaning' | 'weighing' | 'vet' | 'vaccine';

export interface SampleCare {
  id: string;
  date: string;
  allDay?: boolean;
  care: CareKey;
  kind: KindKey;
  status: CareStatus;
  /** Le soin porte une action « Marquer comme fait ». */
  actionable?: boolean;
}

/** Écran « Aujourd'hui » : un retard d'hier, puis la journée. */
export const TODAY_CARE: SampleCare[] = [
  { id: 't1', date: '2026-10-01T00:00:00Z', allDay: true, care: 'terrarium', kind: 'cleaning', status: 'overdue' },
  { id: 't2', date: '2026-10-02T08:00:00Z', care: 'deworm', kind: 'medication', status: 'done' },
  { id: 't3', date: '2026-10-02T12:30:00Z', care: 'feed', kind: 'feeding', status: 'due', actionable: true },
];

/** Agenda : les jours suivants. */
export const UPCOMING_CARE: SampleCare[] = [
  { id: 'u1', date: '2026-10-02T18:00:00Z', care: 'weigh', kind: 'weighing', status: 'due' },
  { id: 'u2', date: '2026-10-03T00:00:00Z', allDay: true, care: 'hay', kind: 'feeding', status: 'planned' },
  { id: 'u3', date: '2026-10-03T09:00:00Z', care: 'molt', kind: 'cleaning', status: 'planned' },
  { id: 'u4', date: '2026-10-08T14:30:00Z', care: 'vet', kind: 'vet', status: 'planned' },
];

/** Pesées de Moka sur un an (kg). */
export const CAT_WEIGHTS = [
  { date: '2025-10-04', kg: 4.1 },
  { date: '2026-01-10', kg: 4.3 },
  { date: '2026-04-12', kg: 4.2 },
  { date: '2026-07-05', kg: 4.4 },
  { date: '2026-09-20', kg: 4.5 },
];

/** Vaccins de Moka : date du dernier acte. */
export const CAT_VACCINES = [
  { key: 'vaccineFeline', date: '2025-10-08', status: 'dueSoon' },
  { key: 'vaccineRabies', date: '2026-03-14', status: 'upToDate' },
] as const;

/** Fiche gecko léopard (valeurs usuelles des fiches d'élevage, cf. Wikipédia). */
export const GECKO = {
  latin: 'Eublepharis macularius',
  authority: 'Blyth, 1854',
  hotSpot: '30-32\u00a0°C',
} as const;

/** Auteurs fictifs des publications de la communauté. */
export const SAMPLE_AUTHORS = { cockatiels: 'Lina', question: 'Hugo' } as const;
