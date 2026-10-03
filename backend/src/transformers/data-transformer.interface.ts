export interface TransformedSpecies {
  key: number;
  name: string;
  canonicalName: string;
  scientificName?: string;
  rank: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  status: string;
  vernacularNames: string[];
  iucnStatus?: string;
  distributions?: Distribution[];
  media?: Media[];
  metrics?: Metrics;
  occurrenceCount?: number;
  source: 'gbif' | 'cache' | 'multi';
  cachedAt?: Date;

  // Multi-source fields
  wikipedia?: WikipediaData | null;
  wikidata?: WikidataData | null;
}

export interface WikipediaData {
  title: string;
  pageid: number;
  url: string;
  thumbnail?: string;
  extract?: string;
  extractHtml?: string;
  originalimage?: string;
  terms?: Record<string, unknown>;
  source: 'wikipedia';
  timestamp?: Date;
}

export interface WikidataData {
  id: string;
  labels?: Record<string, unknown>;
  descriptions?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  claims?: Record<string, unknown>;
  sitelinks?: Record<string, unknown>;
  source: 'wikidata';
  timestamp?: Date;
}

export interface Distribution {
  country: string;
  countryIsoCode: string;
  status: string;
}

export interface Media {
  type: string;
  creator: string;
  identifier: string;
  title: string;
  license: string;
  url: string;
  /** Page source du média (fiche iNaturalist, Wikimedia Commons…). */
  references?: string;
  /** Type MIME (« image/jpeg »). */
  format?: string;
}

export interface Metrics {
  usage: number;
  issues: number;
  extensions: string[];
}

export interface TransformedSearchResult {
  results: TransformedSpecies[];
  total: number;
  source: 'gbif' | 'cache' | 'multi';
  cachedAt?: Date;
}

export interface TransformedVernacularResult {
  results: string[];
  source: 'gbif' | 'cache' | 'multi';
  cachedAt?: Date;
}

export interface TransformedOccurrenceCountResult {
  count: number;
  limit: number;
  offset: number;
  source: 'gbif' | 'cache' | 'multi';
  cachedAt?: Date;
}
