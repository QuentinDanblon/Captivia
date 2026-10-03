import { Injectable, Logger } from '@nestjs/common';
import {
  TransformedSpecies,
  TransformedSearchResult,
  TransformedVernacularResult,
  TransformedMediaResult,
  TransformedDistributionResult,
  TransformedMetricsResult,
  TransformedOccurrenceCountResult,
  Distribution,
  Media,
  Metrics,
  WikipediaData,
  WikidataData,
  ConservationStatus,
  Classification,
  Description,
  Image,
  RelatedSpecies,
  MultiSourceResult,
} from './data-transformer.interface';

@Injectable()
export class SpeciesTransformerService {
  private readonly logger = new Logger(SpeciesTransformerService.name);

  transformSearchResults(gbifResults: any[]): TransformedSearchResult {
    this.logger.debug(`Transforming ${gbifResults.length} search results`);

    return {
      results: gbifResults.map((item) => this.transformSpecies(item)),
      total: gbifResults.length,
      source: 'gbif',
      cachedAt: new Date(),
    };
  }

  transformSpecies(gbifSpecies: any): TransformedSpecies {
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
      distributions: this.transformDistributions(gbifSpecies.distributions || []),
      media: this.transformMedia(gbifSpecies.media || []),
      metrics: this.transformMetrics(gbifSpecies.metrics),
      occurrenceCount: gbifSpecies.occurrenceCount,
      source: 'gbif',
      cachedAt: new Date(),
    };
  }

  transformVernacularNames(gbifResults: any[]): TransformedVernacularResult {
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

  transformMedia(gbifResults: any[]): Media[] {
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

  transformDistributions(gbifResults: any[]): Distribution[] {
    const items = gbifResults ?? [];
    this.logger.debug(`Transforming ${items.length} distribution items`);

    return items.map((d) => ({
      country: d.country,
      countryIsoCode: d.countryIsoCode,
      status: d.status,
    }));
  }

  transformMetrics(gbifMetrics: any): Metrics {
    this.logger.debug('Transforming metrics');

    return {
      usage: gbifMetrics?.usage || 0,
      issues: gbifMetrics?.issues || 0,
      extensions: gbifMetrics?.extensions || [],
    };
  }

  transformOccurrenceCount(
    gbifResult: any,
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

  /**
   * Transform Wikipedia data
   */
  transformWikipediaData(wikipediaData: any): WikipediaData | null {
    if (!wikipediaData) {
      return null;
    }

    return {
      title: wikipediaData.title,
      pageid: wikipediaData.pageid,
      url: wikipediaData.content_urls?.desktop?.page || wikipediaData.url,
      thumbnail: wikipediaData.thumbnail?.source,
      extract: wikipediaData.extract,
      extractHtml: wikipediaData.extract_html,
      originalimage: wikipediaData.originalimage?.source,
      terms: wikipediaData.terms || {},
      source: 'wikipedia',
      timestamp: new Date(),
    };
  }

  /**
   * Transform Wikidata data
   */
  transformWikidataData(wikidataData: any): WikidataData | null {
    if (!wikidataData) {
      return null;
    }

    return {
      id: wikidataData.id,
      labels: wikidataData.labels,
      descriptions: wikidataData.descriptions,
      aliases: wikidataData.aliases,
      claims: wikidataData.claims,
      sitelinks: wikidataData.sitelinks,
      source: 'wikidata',
      timestamp: new Date(),
    };
  }

  /**
   * Transform conservation status data
   */
  transformConservationStatus(conservationData: any): ConservationStatus | null {
    if (!conservationData) {
      return null;
    }

    return {
      iucnStatus: conservationData.iucnStatus?.value,
      citesStatus: conservationData.citesStatus?.value,
      berneStatus: conservationData.berneStatus?.value,
      cmsStatus: conservationData.cmsStatus?.value,
      statusDescription: conservationData.statusDescription?.value,
      source: 'wikidata',
    };
  }

  /**
   * Transform classification data
   */
  transformClassification(classificationData: any): Classification | null {
    if (!classificationData) {
      return null;
    }

    return {
      family: classificationData.family?.value,
      genus: classificationData.genus?.value,
      order: classificationData.order?.value,
      phylum: classificationData.phylum?.value,
      class: classificationData.class?.value,
      kingdom: classificationData.kingdom?.value,
      scientificName: classificationData.scientificName?.value,
      commonName: classificationData.commonName?.value,
      image: classificationData.image?.value,
      source: 'wikidata',
    };
  }

  /**
   * Transform description data
   */
  transformDescriptions(descriptionData: any): Description | null {
    if (!descriptionData) {
      return null;
    }

    return {
      description: descriptionData.description?.value,
      shortDescription: descriptionData.shortDescription?.value,
      alias: descriptionData.alias?.value,
      source: 'wikidata',
    };
  }

  /**
   * Transform image data
   */
  transformImages(imagesData: any[]): Image[] {
    if (!imagesData || !Array.isArray(imagesData)) {
      return [];
    }

    return imagesData.map((img) => ({
      image: img.image?.value,
      license: img.license?.value,
      caption: img.caption?.value,
      source: 'wikidata',
    }));
  }

  /**
   * Transform related species data
   */
  transformRelatedSpecies(relatedData: any[]): RelatedSpecies[] {
    if (!relatedData || !Array.isArray(relatedData)) {
      return [];
    }

    return relatedData.map((related) => ({
      related: related.related?.value,
      relatedLabel: related.relatedLabel?.value,
      relatedDescription: related.relatedDescription?.value,
      source: 'wikidata',
    }));
  }

  /**
   * Transform multi-source data
   */
  transformMultiSourceData(multiData: MultiSourceResult): TransformedSpecies | null {
    if (!multiData) {
      return null;
    }

    const gbifSpecies = multiData.gbif;
    const canonicalName = gbifSpecies?.canonicalName || gbifSpecies?.name;
    const wikipediaData = this.transformWikipediaData(multiData.wikipedia);
    const wikidataData = this.transformWikidataData(multiData.wikidata);

    return {
      key: gbifSpecies?.key,
      name: canonicalName,
      canonicalName,
      scientificName: gbifSpecies?.scientificName || canonicalName,
      rank: gbifSpecies?.rank,
      kingdom: gbifSpecies?.kingdom,
      phylum: gbifSpecies?.phylum,
      class: gbifSpecies?.class,
      order: gbifSpecies?.order,
      family: gbifSpecies?.family,
      genus: gbifSpecies?.genus,
      status: gbifSpecies?.status || 'UNKNOWN',
      vernacularNames: this.extractVernacularNames(gbifSpecies),
      iucnStatus: gbifSpecies?.iucn?.status,
      distributions: this.transformDistributions(gbifSpecies?.distributions || []),
      media: this.transformMedia(gbifSpecies?.media || []),
      metrics: this.transformMetrics(gbifSpecies?.metrics),
      occurrenceCount: gbifSpecies?.occurrenceCount,
      wikipedia: wikipediaData,
      wikidata: wikidataData,
      source: 'multi',
      cachedAt: new Date(),
    };
  }

  /**
   * Combine multi-source data into a unified result
   */
  transformMultiSourceResult(multiData: MultiSourceResult): MultiSourceResult {
    return {
      gbif: multiData.gbif,
      wikipedia: this.transformWikipediaData(multiData.wikipedia),
      wikidata: this.transformWikidataData(multiData.wikidata),
      conservation: this.transformConservationStatus(multiData.conservation),
      classification: this.transformClassification(multiData.classification),
      description: this.transformDescriptions(multiData.description),
      images: this.transformImages(multiData.images),
      related: this.transformRelatedSpecies(multiData.related),
      source: 'multi',
      timestamp: new Date(),
    };
  }

  private extractVernacularNames(gbifSpecies: any): string[] {
    return (
      gbifSpecies?.vernacularNames
        ?.filter((vn: any) => vn.language === 'french')
        .map((vn: any) => vn.name) || []
    );
  }
}