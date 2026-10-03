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
  terms?: Record<string, any>;
  source: 'wikipedia';
  timestamp?: Date;
}

export interface WikidataData {
  id: string;
  labels?: Record<string, any>;
  descriptions?: Record<string, any>;
  aliases?: Record<string, any>;
  claims?: Record<string, any>;
  sitelinks?: Record<string, any>;
  source: 'wikidata';
  timestamp?: Date;
}

export interface ConservationStatus {
  iucnStatus?: string;
  citesStatus?: string;
  berneStatus?: string;
  cmsStatus?: string;
  statusDescription?: string;
  source: string;
}

export interface Classification {
  family?: string;
  genus?: string;
  order?: string;
  phylum?: string;
  class?: string;
  kingdom?: string;
  scientificName?: string;
  commonName?: string;
  image?: string;
  source: string;
}

export interface Description {
  description?: string;
  shortDescription?: string;
  alias?: string;
  source: string;
}

export interface Image {
  image?: string;
  license?: string;
  caption?: string;
  source: string;
}

export interface RelatedSpecies {
  related?: string;
  relatedLabel?: string;
  relatedDescription?: string;
  source: string;
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

export interface TransformedMediaResult {
  results: Media[];
  source: 'gbif' | 'cache' | 'multi';
  cachedAt?: Date;
}

export interface TransformedDistributionResult {
  results: Distribution[];
  source: 'gbif' | 'cache' | 'multi';
  cachedAt?: Date;
}

export interface TransformedMetricsResult {
  data: Metrics;
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

export interface MultiSourceResult {
  gbif?: any;
  wikipedia?: any;
  wikidata?: any;
  conservation?: any;
  classification?: any;
  description?: any;
  images?: any;
  related?: any;
  source: 'multi';
  timestamp: Date;
}