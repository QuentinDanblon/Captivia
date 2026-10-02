export type AgendaItemType =
  | 'routine'
  | 'medication'
  | 'vaccination'
  | 'vet_appointment';
export type AgendaItemStatus = 'pending' | 'done' | 'skipped' | 'cancelled';

export interface AgendaItem {
  /** Identifiant stable d'une occurrence : `<type>:<sourceId>:<date ISO>`. */
  id: string;
  /** Instant ISO 8601 (UTC). Pour un élément `allDay`, minuit UTC du jour concerné. */
  date: string;
  /** Jour `YYYY-MM-DD` (UTC) de l'instant `date`. */
  day: string;
  /** Vrai pour une échéance sans heure (rappel de vaccin). */
  allDay: boolean;
  type: AgendaItemType;
  animalId: string;
  animalName: string;
  title: string;
  /** Précision facultative (notes du médicament, motif / lieu du RDV…). */
  detail: string | null;
  status: AgendaItemStatus;
  /** Id de la routine / du médicament / de la vaccination / du RDV d'origine. */
  sourceId: string;
}

export interface AgendaResult {
  from: string;
  to: string;
  items: AgendaItem[];
  /** Vrai si la liste a été tronquée à `MAX_AGENDA_ITEMS` (réduire la période). */
  truncated: boolean;
}
