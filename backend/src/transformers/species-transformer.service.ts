import { Injectable, Logger } from '@nestjs/common';
import {
  TransformedSpecies,
  TransformedSearchResult,
  TransformedVernacularResult,
  TransformedOccurrenceCountResult,
  Distribution,
  Media,
  Metrics,
} from './data-transformer.interface';
import type {
  GbifDistribution,
  GbifMedia,
  GbifMetrics,
  GbifSpecies,
  GbifVernacularName,
} from '../external/gbif.types';

@Injectable()
export class SpeciesTransformerService {
  private readonly logger = new Logger(SpeciesTransformerService.name);

  transformSearchResults(gbifResults: GbifSpecies[]): TransformedSearchResult {
    this.logger.debug(`Transforming ${gbifResults.length} search results`);

    return {
      results: gbifResults.map((item) => this.transformSpecies(item)),
      total: gbifResults.length,
      source: 'gbif',
      cachedAt: new Date(),
    };
  }

  transformSpecies(gbifSpecies: GbifSpecies): TransformedSpecies {
    const canonicalName = gbifSpecies.canonicalName || gbifSpecies.name;
    return {
      key: gbifSpecies.key,
      name: canonicalName,
      canonicalName,
      scientificName: gbifSpecies.scientificName || canonicalName,
      rank: gbifSpecies.rank,
      kingdom: gbifSpecies.kingdom,
      phylum: gbifSpecies.phylum,
      class: gbifSpecies.class,
      order: gbifSpecies.order,
      family: gbifSpecies.family,
      genus: gbifSpecies.genus,
      status: gbifSpecies.status || 'UNKNOWN',
      vernacularNames: this.extractVernacularNames(gbifSpecies),
      iucnStatus: gbifSpecies.iucn?.status,
      distributions: this.transformDistributions(
        gbifSpecies.distributions || [],
      ),
      media: this.transformMedia(gbifSpecies.media || []),
      metrics: this.transformMetrics(gbifSpecies.metrics),
      occurrenceCount: gbifSpecies.occurrenceCount,
      source: 'gbif',
      cachedAt: new Date(),
    };
  }

  transformVernacularNames(
    gbifResults: GbifVernacularName[],
  ): TransformedVernacularResult {
    const items = gbifResults ?? [];
    this.logger.debug(`Transforming ${items.length} vernacular names`);

    return {
      results: items
        .filter((vn) => vn.language === 'french')
        .map((vn) => vn.name),
      source: 'gbif',
      cachedAt: new Date(),
    };
  }

  transformMedia(gbifResults: GbifMedia[]): Media[] {
    const items = gbifResults ?? [];
    this.logger.debug(`Transforming ${items.length} media items`);

    return items.map((m) => ({
      type: m.type,
      creator: m.creator,
      identifier: m.identifier,
      title: m.title,
      license: m.license,
      url: m.identifier,
      // Page source (crédit photo lié) et type MIME (image ou vidéo), quand GBIF les fournit.
      ...(m.references ? { references: m.references } : {}),
      ...(m.format ? { format: m.format } : {}),
    }));
  }

  transformDistributions(gbifResults: GbifDistribution[]): Distribution[] {
    const items = gbifResults ?? [];
    this.logger.debug(`Transforming ${items.length} distribution items`);

    return items.map((d) => ({
      country: d.country,
      countryIsoCode: d.countryIsoCode,
      status: d.status,
    }));
  }

  transformMetrics(gbifMetrics: GbifMetrics | null | undefined): Metrics {
    this.logger.debug('Transforming metrics');

    return {
      usage: gbifMetrics?.usage || 0,
      issues: gbifMetrics?.issues || 0,
      extensions: gbifMetrics?.extensions || [],
    };
  }

  transformOccurrenceCount(
    gbifResult:
      | { count?: string | number; limit?: unknown; offset?: unknown }
      | null
      | undefined,
  ): TransformedOccurrenceCountResult {
    this.logger.debug('Transforming occurrence count');
    const count = parseInt(String(gbifResult?.count ?? ''), 10);
    const limit = Number(gbifResult?.limit) || 0;
    const offset = Number(gbifResult?.offset) || 0;

    return {
      count: Number.isNaN(count) ? 0 : count,
      limit: Number.isNaN(limit) ? 0 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
      source: 'gbif',
      cachedAt: new Date(),
    };
  }

  private extractVernacularNames(gbifSpecies: GbifSpecies): string[] {
    return (
      gbifSpecies?.vernacularNames
        ?.filter((vn) => vn.language === 'french')
        .map((vn) => vn.name) || []
    );
  }
}
