import { Injectable, Logger } from '@nestjs/common';
import type { GbifSpecies } from '../external/gbif.types';
import {
  SpeciesFilter,
  FilteredSearchResult,
} from './species-filter.interface';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';

@Injectable()
export class SpeciesFilterService {
  private readonly logger = new Logger(SpeciesFilterService.name);

  constructor(private transformer: SpeciesTransformerService) {}

  applyFilters<T extends Partial<GbifSpecies>>(
    gbifResults: T[],
    filters: SpeciesFilter,
  ): FilteredSearchResult<T> {
    let results = [...gbifResults];
    const appliedFilters: string[] = [];

    // Filtrer par rang
    if (filters.rank) {
      results = results.filter((s) => s.rank === filters.rank);
      appliedFilters.push(`rank:${filters.rank}`);
    }

    // Filtrer par royaume
    if (filters.kingdom) {
      results = results.filter((s) => s.kingdom === filters.kingdom);
      appliedFilters.push(`kingdom:${filters.kingdom}`);
    }

    // Filtrer par phylum
    if (filters.phylum) {
      results = results.filter((s) => s.phylum === filters.phylum);
      appliedFilters.push(`phylum:${filters.phylum}`);
    }

    // Filtrer par classe (GBIF uses "class" key)
    if (filters.class) {
      results = results.filter((s) => s.class === filters.class);
      appliedFilters.push(`class:${filters.class}`);
    }

    // Filtrer par ordre
    if (filters.order) {
      results = results.filter((s) => s.order === filters.order);
      appliedFilters.push(`order:${filters.order}`);
    }

    // Filtrer par famille
    if (filters.family) {
      results = results.filter((s) => s.family === filters.family);
      appliedFilters.push(`family:${filters.family}`);
    }

    // Filtrer par genre
    if (filters.genus) {
      results = results.filter((s) => s.genus === filters.genus);
      appliedFilters.push(`genus:${filters.genus}`);
    }

    // Filtrer par statut IUCN
    if (filters.iucnStatus) {
      results = results.filter((s) => s.iucn?.status === filters.iucnStatus);
      appliedFilters.push(`iucn:${filters.iucnStatus}`);
    }

    // Filtrer par pays de distribution
    if (filters.country) {
      results = results.filter((s) =>
        s.distributions?.some((d) => d.country === filters.country),
      );
      appliedFilters.push(`country:${filters.country}`);
    }

    // Limiter le nombre de résultats
    if (filters.limit) {
      results = results.slice(0, filters.limit);
      appliedFilters.push(`limit:${filters.limit}`);
    }

    return {
      results,
      total: results.length,
      filtersApplied: appliedFilters,
    };
  }

  buildGbifQuery(filters: SpeciesFilter): Record<string, string | number> {
    const query: Record<string, string | number> = {};

    if (filters.query) {
      query.q = filters.query;
    }

    if (filters.rank) {
      query.rank = filters.rank;
    }

    if (filters.kingdom) {
      query.kingdom = filters.kingdom;
    }

    if (filters.family) {
      query.family = filters.family;
    }

    if (filters.limit) {
      query.limit = filters.limit;
    }

    if (filters.offset) {
      query.offset = filters.offset;
    }

    return query;
  }
}
