// Types partagés par la page détail animal et ses composants.

export interface RoutineSchedule {
  time?: string;
  recurrence?: string;
  date?: string;
  weekDay?: number;
  dayOfMonth?: number;
  intervalHours?: number;
}

export interface HistoryEntry {
  id: string;
  type: string;
  doneAt: string;
  note?: string | null;
}

export interface SpeciesDisease {
  name: string;
  symptoms?: string;
  prevention?: string;
  whenToConsult?: string;
}

export interface SpeciesHealthData {
  editorial?: { diseases?: SpeciesDisease[] };
}

export interface SpeciesLegislationItem {
  country: string;
  status: string;
  details?: { citesAppendix?: string | null; euAnnex?: string | null; permits?: string[]; restrictions?: string[] };
  sources?: string[];
}

export interface SpeciesLegislationData {
  editorial?: SpeciesLegislationItem[];
}

export interface EquipmentRecommendation {
  label: string;
  category?: string;
  size?: string;
}

export interface SpeciesEquipmentData {
  recommendations?: EquipmentRecommendation[];
}

export interface SpeciesFoodProduct {
  product_name?: string;
  name?: string;
  brands?: string;
  categories?: string;
}

export interface Routine {
  id: string;
  name?: string;
  type: string;
  frequency: string;
  schedule: RoutineSchedule;
  active: boolean;
}

export interface HealthRecord {
  id: string;
  type: string;
  title: string;
  date: string;
  notes?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Species {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
}
