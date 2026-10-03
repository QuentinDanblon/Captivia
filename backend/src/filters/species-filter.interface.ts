import type { GbifSpecies } from '../external/gbif.types';

export interface SpeciesFilter {
  query?: string;
  rank?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  status?: string;
  iucnStatus?: string;
  country?: string;
  language?: string;
  /** Filtre sur les fiches locales uniquement (domestique, semi-domestique, NAC). */
  domesticationType?: string;
  limit?: number;
  offset?: number;
}

export interface FilteredSearchResult<T = Partial<GbifSpecies>> {
  results: T[];
  total: number;
  filtersApplied: string[];
}
