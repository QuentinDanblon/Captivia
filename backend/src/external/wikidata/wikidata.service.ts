import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Wikidata API Service for fetching species information from Wikidata
 * Uses Wikidata Query Service and REST API to get structured data
 */
@Injectable()
export class WikidataService {
  private readonly logger = new Logger(WikidataService.name);
  private readonly wikidataApi: AxiosInstance;
  private readonly wikidataQueryApi: AxiosInstance;
  private readonly wikidataSearchApi: AxiosInstance;
  private readonly wikidataBaseUrl = 'https://www.wikidata.org/wiki/Special:EntityData';
  private readonly wikidataQueryUrl = 'https://query.wikidata.org/sparql';

  constructor() {
    this.wikidataApi = axios.create({
      baseURL: this.wikidataBaseUrl,
      headers: {
        'User-Agent': 'Captivia/1.0 (https://captivia.com)',
      },
      timeout: 10000,
    });

    this.wikidataQueryApi = axios.create({
      baseURL: this.wikidataQueryUrl,
      timeout: 10000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Captivia/1.0 (https://captivia.com)',
      },
    });

    this.wikidataSearchApi = axios.create({
      baseURL: 'https://www.wikidata.org/w/api.php',
      timeout: 10000,
      headers: {
        'User-Agent': 'Captivia/1.0 (https://captivia.com)',
      },
    });
  }

  /**
   * Search Wikidata for a species by name using the entity search API
   * @param query Search query string
   * @returns Search results from Wikidata
   */
  async searchSpecies(query: string) {
    try {
      const response = await this.wikidataSearchApi.get('', {
        params: {
          action: 'wbsearchentities',
          search: query,
          language: 'en',
          format: 'json',
          limit: 10,
        },
      });

      return this.transformSearchResults(response.data);
    } catch (error) {
      this.logger.error('Wikidata search failed', error);
      return { results: [], source: 'wikidata' };
    }
  }

  /**
   * Get Wikidata entity by QID
   * @param qid Wikidata QID (e.g., Q240)
   * @returns Entity data
   */
  async getEntity(qid: string) {
    try {
      const response = await this.wikidataApi.get(`/${qid}.json`);

      if (!response.data || !response.data.entities || !response.data.entities[qid]) {
        return null;
      }

      return this.transformEntity(response.data.entities[qid]);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata entity fetch failed', error);
      throw error;
    }
  }

  /**
   * Get species information by scientific name
   * @param scientificName Scientific name (e.g., "Panthera leo")
   * @returns Species data from Wikidata
   */
  async getSpeciesByScientificName(scientificName: string) {
    try {
      // Try to find the species using common name or scientific name
      const sparqlQuery = `
        SELECT ?item ?itemLabel ?itemDescription ?scientificName ?commonName ?image ?taxonRank ?family ?genus ?iucnStatus ?citesStatus WHERE {
          ?item wdt:P225 "${scientificName}" .
          OPTIONAL { ?item wdt:P1843 ?commonName } .
          OPTIONAL { ?item wdt:P1843 ?itemLabel } .
          OPTIONAL { ?item wdt:P31 wd:Q16521 } .
          OPTIONAL { ?item wdt:P225 ?scientificName } .
          OPTIONAL { ?item wdt:P18 ?image } .
          OPTIONAL { ?item wdt:P105 ?taxonRank } .
          OPTIONAL { ?item wdt:P734 ?genus } .
          OPTIONAL { ?item wdt:P735 ?family } .
          OPTIONAL { ?item wdt:P141 ?iucnStatus } .
          OPTIONAL { ?item wdt:P727 ?citesStatus } .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 1
      `;

      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      if (!response.data.results || !response.data.results.bindings || response.data.results.bindings.length === 0) {
        return null;
      }

      return this.transformEntity(response.data.results.bindings[0]);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata species fetch failed', error);
      throw error;
    }
  }

  /**
   * Get conservation status (IUCN, CITES, etc.)
   * @param qid Wikidata QID
   * @returns Conservation status data
   */
  async getConservationStatus(qid: string) {
    if (!qid) return null;
    try {
      const sparqlQuery = `
        SELECT ?iucnStatus ?citesStatus ?berneStatus ?cmsStatus ?statusDescription WHERE {
          VALUES ?item { wd:${qid} } .
          OPTIONAL { ?item wdt:P141 ?iucnStatus } .
          OPTIONAL { ?item wdt:P727 ?citesStatus } .
          OPTIONAL { ?item wdt:P726 ?berneStatus } .
          OPTIONAL { ?item wdt:P725 ?cmsStatus } .
          OPTIONAL { ?item wdt:P146 ?statusDescription } .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 1
      `;

      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      if (!response.data.results || !response.data.results.bindings || response.data.results.bindings.length === 0) {
        return null;
      }

      return this.transformConservationStatus(response.data.results.bindings[0]);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata conservation status fetch failed', error);
      throw error;
    }
  }

  /**
   * Get species classification data (family, genus, order, etc.)
   * @param qid Wikidata QID
   * @returns Classification data
   */
  async getClassification(qid: string) {
    if (!qid) return null;
    try {
      const sparqlQuery = `
        SELECT ?item ?family ?genus ?order ?phylum ?class ?kingdom ?scientificName ?commonName ?image WHERE {
          VALUES ?item { wd:${qid} } .
          OPTIONAL { ?item wdt:P734 ?genus } .
          OPTIONAL { ?item wdt:P735 ?family } .
          OPTIONAL { ?item wdt:P105 ?order } .
          OPTIONAL { ?item wdt:P279 ?phylum } .
          OPTIONAL { ?item wdt:P279 ?class } .
          OPTIONAL { ?item wdt:P279 ?kingdom } .
          OPTIONAL { ?item wdt:P225 ?scientificName } .
          OPTIONAL { ?item wdt:P1843 ?commonName } .
          OPTIONAL { ?item wdt:P18 ?image } .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 1
      `;

      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      if (!response.data.results || !response.data.results.bindings || response.data.results.bindings.length === 0) {
        return null;
      }

      return this.transformClassification(response.data.results.bindings[0]);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata classification fetch failed', error);
      throw error;
    }
  }

  /**
   * Get species descriptions from Wikidata
   * @param qid Wikidata QID
   * @returns Description data
   */
  async getDescriptions(qid: string) {
    if (!qid) return null;
    try {
      const sparqlQuery = `
        SELECT ?description ?shortDescription ?alias WHERE {
          VALUES ?item { wd:${qid} } .
          OPTIONAL { ?item wdt:P1476 ?description } .
          OPTIONAL { ?item wdt:P1813 ?shortDescription } .
          OPTIONAL { ?item wdt:P1814 ?alias } .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 1
      `;

      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      if (!response.data.results || !response.data.results.bindings || response.data.results.bindings.length === 0) {
        return null;
      }

      return this.transformDescriptions(response.data.results.bindings[0]);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata descriptions fetch failed', error);
      throw error;
    }
  }

  /**
   * Get species images from Wikidata
   * @param qid Wikidata QID
   * @returns Image data
   */
  async getImages(qid: string) {
    if (!qid) return null;
    try {
      const sparqlQuery = `
        SELECT ?image ?license ?caption WHERE {
          VALUES ?item { wd:${qid} } .
          OPTIONAL { ?item wdt:P18 ?image } .
          OPTIONAL { ?item wdt:P6216 ?license } .
          OPTIONAL { ?item wdt:P4032 ?caption } .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 5
      `;

      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      if (!response.data.results || !response.data.results.bindings || response.data.results.bindings.length === 0) {
        return null;
      }

      return this.transformImages(response.data.results.bindings);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata images fetch failed', error);
      throw error;
    }
  }

  /**
   * Get related species (siblings, subspecies)
   * @param qid Wikidata QID
   * @returns Related species data
   */
  async getRelatedSpecies(qid: string) {
    if (!qid) return null;
    try {
      const sparqlQuery = `
        SELECT ?related ?relatedLabel ?relatedDescription WHERE {
          VALUES ?item { wd:${qid} } .
          ?related wdt:P31 wd:Q16521 .
          ?related wdt:P727 ?family .
          ?item wdt:P727 ?family .
          FILTER(?related != ?item)
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 10
      `;

      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      if (!response.data.results || !response.data.results.bindings || response.data.results.bindings.length === 0) {
        return null;
      }

      return this.transformRelatedSpecies(response.data.results.bindings);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikidata related species fetch failed', error);
      throw error;
    }
  }

  /**
   * Check Wikidata API health
   * @returns Health status
   */
  async checkApiHealth() {
    try {
      const sparqlQuery = 'SELECT ?item WHERE { ?item wdt:P225 "Panthera leo" } LIMIT 1';
      const response = await this.wikidataQueryApi.get('', {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
        timeout: 5000,
      });
      return {
        status: 'healthy',
        responseTime: response.headers['request-duration'] || 'unknown',
      };
    } catch (error) {
      this.logger.error('Wikidata API health check failed', error);
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Transform Wikidata entity search results
   */
  private transformSearchResults(data: any) {
    if (!data || !Array.isArray(data.search)) {
      return { results: [], source: 'wikidata' };
    }

    return {
      results: data.search.map((item: any) => ({
        item: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
        id: item.id,
        itemLabel: item.label,
        itemDescription: item.description,
        aliases: item.aliases,
        match: item.match,
        source: 'wikidata',
      })),
      source: 'wikidata',
    };
  }

  /**
   * Transform Wikidata entity data
   */
  private transformEntity(data: any) {
    return {
      id: data.id,
      labels: data.labels,
      descriptions: data.descriptions,
      aliases: data.aliases,
      claims: data.claims,
      sitelinks: data.sitelinks,
      source: 'wikidata',
      timestamp: new Date(),
    };
  }

  /**
   * Transform conservation status data
   */
  private transformConservationStatus(data: any) {
    return {
      iucnStatus: data.iucnStatus?.value,
      citesStatus: data.citesStatus?.value,
      berneStatus: data.berneStatus?.value,
      cmsStatus: data.cmsStatus?.value,
      statusDescription: data.statusDescription?.value,
      source: 'wikidata',
    };
  }

  /**
   * Transform classification data
   */
  private transformClassification(data: any) {
    return {
      family: data.family?.value,
      genus: data.genus?.value,
      order: data.order?.value,
      phylum: data.phylum?.value,
      class: data.class?.value,
      kingdom: data.kingdom?.value,
      scientificName: data.scientificName?.value,
      commonName: data.commonName?.value,
      image: data.image?.value,
      source: 'wikidata',
    };
  }

  /**
   * Transform description data
   */
  private transformDescriptions(data: any) {
    return {
      description: data.description?.value,
      shortDescription: data.shortDescription?.value,
      alias: data.alias?.value,
      source: 'wikidata',
    };
  }

  /**
   * Transform image data
   */
  private transformImages(bindings: any[]) {
    return bindings.map((binding: any) => ({
      image: binding.image?.value,
      license: binding.license?.value,
      caption: binding.caption?.value,
      source: 'wikidata',
    }));
  }

  /**
   * Transform related species data
   */
  private transformRelatedSpecies(bindings: any[]) {
    return bindings.map((binding: any) => ({
      related: binding.related?.value,
      relatedLabel: binding.relatedLabel?.value,
      relatedDescription: binding.relatedDescription?.value,
      source: 'wikidata',
    }));
  }
}