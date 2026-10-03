/**
 * Données de la fiche espèce, telles que renvoyées par l'API (GET /species/:id et ses
 * sous-ressources). Les sections éditoriales sont les lignes Prisma (SpeciesFeeding,
 * SpeciesHabitat…) ; quelques anciens noms de champs restent acceptés (`temperature`,
 * `difficulty`…) pour les fiches et jeux d'essai antérieurs.
 */
import type { SpeciesReproduction } from '@/lib/api';

/** Source citée par une section éditoriale. */
export interface SourceRef {
  type?: string;
  url?: string;
  title?: string;
}

export interface FoodEntry {
  name?: string;
  frequency?: string;
  notes?: string;
  reason?: string;
}

export interface SpeciesFeeding {
  dietType?: string | null;
  mealFrequency?: string | null;
  feedingFrequency?: string | null;
  recommendedFoods?: FoodEntry[] | string | null;
  foodsToAvoid?: FoodEntry[] | string | null;
  avoidedFoods?: FoodEntry[] | string | null;
  specificNeeds?: string | null;
  sources?: SourceRef[] | null;
}

export interface SpeciesHabitat {
  habitatType?: string | null;
  tempMin?: number | null;
  tempMax?: number | null;
  humidityMin?: number | null;
  humidityMax?: number | null;
  minSpaceSize?: string | null;
  lightNeeds?: string | null;
  activityEnrichment?: string | null;
  hygieneNotes?: string | null;
  costEstimate?: string | null;
  /** Anciens champs texte. */
  temperature?: string | null;
  humidity?: string | null;
  spaceRequirements?: string | null;
  lighting?: string | null;
  enrichment?: string | null;
  sources?: SourceRef[] | null;
}

export interface SpeciesBehavior {
  generalBehavior?: string | null;
  sociability?: string | null;
  difficultyLevel?: string | null;
  difficulty?: string | null;
  compatibilityWithChildren?: string | null;
  compatibilityWithOtherAnimals?: string | null;
  compatibility?: string | null;
  sources?: SourceRef[] | null;
}

export interface SpeciesData {
  key?: number;
  scientificName: string;
  canonicalName?: string;
  rank?: string;
  iucnStatus?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  distribution?: string | string[];
  profile?: {
    speciesId?: number;
    sourceUrl?: string | null;
    commonNameFr?: string;
    scientificName?: string;
    category?: string;
    subcategory?: string | null;
    domesticationType?: string;
    description?: string | null;
  } | null;
  habitat?: SpeciesHabitat | null;
  behavior?: SpeciesBehavior | null;
  feeding?: SpeciesFeeding | null;
}

export interface Disease {
  name: string;
  symptoms?: string;
  prevention?: string;
  whenToConsult?: string;
  needsReview?: boolean;
}

export interface HealthData {
  editorial?: {
    diseases?: Disease[];
    sources?: SourceRef[];
    updatedAt?: string;
    needsReview?: boolean;
  } | null;
  pubmed?: Array<{ pmid: string; title: string; journal?: string; pubDate?: string; url?: string }>;
  needsReview?: boolean;
}

export interface LegislationItem {
  country: string;
  status: string;
  details?: {
    citesAppendix?: string | null;
    euAnnex?: string | null;
    permits?: string[];
    restrictions?: string[];
    /** Statut issu de l'enrichissement automatique, pas encore relu. */
    needsReview?: boolean;
  } | null;
  sources?: string[];
  needsReview?: boolean;
}

export interface LegislationData {
  editorial?: LegislationItem[];
}

export interface EquipmentRecommendation {
  id: string;
  category: string;
  label: string;
  size?: string;
}

export interface EquipmentData {
  recommendations?: EquipmentRecommendation[];
}

export type ReproductionData = SpeciesReproduction & { sources?: SourceRef[] | null };

export interface SpeciesSheet {
  species: SpeciesData;
  health: HealthData | null;
  legislation: LegislationData | null;
  equipment: EquipmentData | null;
  reproduction: ReproductionData | null;
}
