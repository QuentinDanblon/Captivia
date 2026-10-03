/**
 * Formes des réponses de l'API GBIF telles que le backend les consomme.
 *
 * Ce ne sont pas des schémas exhaustifs : seuls les champs lus par le code sont
 * décrits. Les champs censés être toujours présents (clé, taxonomie) sont typés
 * comme tels, conformément au contrat de l'API ; ceux que le code lit avec `?.`
 * ou `||` sont optionnels.
 */

export interface GbifVernacularName {
  name: string;
  language?: string;
}

export interface GbifDistribution {
  country: string;
  countryIsoCode: string;
  status: string;
}

export interface GbifMedia {
  type: string;
  creator: string;
  identifier: string;
  title: string;
  license: string;
  /** Page source du média (fiche iNaturalist, Wikimedia Commons…). */
  references?: string;
  /** Type MIME (« image/jpeg »). */
  format?: string;
}

export interface GbifMetrics {
  usage?: number;
  issues?: number;
  extensions?: string[];
}

export interface GbifSpecies {
  key: number;
  name: string;
  canonicalName?: string;
  scientificName?: string;
  vernacularName?: string;
  rank: string;
  taxonomicStatus?: string;
  status?: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  iucn?: { status?: string };
  iucnRedListCategory?: string;
  vernacularNames?: GbifVernacularName[];
  distributions?: GbifDistribution[];
  media?: GbifMedia[];
  metrics?: GbifMetrics;
  occurrenceCount?: number;
}

/** Réponse paginée de `/species/search`. */
export interface GbifSearchResponse {
  results?: GbifSpecies[];
  count?: number;
  limit?: number;
  offset?: number;
}

/** Enveloppe `{ results }` des sous-ressources (`/vernacularNames`, `/media`…). */
export interface GbifResults<T> {
  results?: T[];
}

/** Réponse de `/occurrence/search` (seuls les compteurs sont lus). */
export interface GbifOccurrenceSearch {
  count: number | string;
  limit: number;
  offset: number;
}

/** Réponse brute de `/species/{key}/iucn` (structure libre, transmise telle quelle). */
export type GbifIucn = Record<string, unknown>;

export interface GbifOccurrenceCount {
  count: number;
  limit: number;
  offset: number;
}
