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
  limit?: number;
  offset?: number;
}

export interface FilteredSpecies {
  results: any[];
  total: number;
  filtersApplied: string[];
}

export interface FilteredSearchResult {
  results: any[];
  total: number;
  filtersApplied: string[];
}
