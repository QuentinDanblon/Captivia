import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../../cache/cache.service';
import { EXTERNAL_REQUEST_DEFAULTS, describeHttpError } from '../../external/http-safety';

interface SpeciesPlusResponse {
  id: number;
  full_name: string;
  author_year: string;
  rank: string;
  cites_listing?: string;
  eu_listing?: string;
  distributions?: Array<{
    iso_code2: string;
    name: string;
    type: string;
  }>;
}

@Injectable()
export class SpeciesPlusService {
  private readonly logger = new Logger(SpeciesPlusService.name);
  private readonly baseUrl = 'https://api.speciesplus.net/api/v1';
  private readonly apiToken = process.env.SPECIESPLUS_API_TOKEN || '';
  private readonly cachePrefix = 'speciesplus:';

  constructor(private readonly cacheService: CacheService) {}

  async searchByScientificName(scientificName: string): Promise<any> {
    const cacheKey = `${this.cachePrefix}search:${scientificName}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/taxon_concepts`, {
        params: {
          name: scientificName,
        },
        headers: {
          'X-Authentication-Token': this.apiToken,
        },
        ...EXTERNAL_REQUEST_DEFAULTS,
      });

      const data = response.data?.taxon_concepts || [];

      // Cache for 7 days
      await this.cacheService.set(cacheKey, JSON.stringify(data), 604800);

      return data;
    } catch (error) {
      this.logger.error(`Species+ search error: ${describeHttpError(error)}`);
      return [];
    }
  }

  async getTaxonDetails(taxonId: number): Promise<SpeciesPlusResponse | null> {
    const cacheKey = `${this.cachePrefix}taxon:${taxonId}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/taxon_concepts/${taxonId}`,
        {
          headers: {
            'X-Authentication-Token': this.apiToken,
          },
          ...EXTERNAL_REQUEST_DEFAULTS,
        },
      );

      const data = response.data?.taxon_concept || null;

      if (data) {
        // Cache for 7 days
        await this.cacheService.set(cacheKey, JSON.stringify(data), 604800);
      }

      return data;
    } catch (error) {
      this.logger.error(`Species+ taxon details error: ${describeHttpError(error)}`);
      return null;
    }
  }

  async getCitesLegislation(taxonId: number): Promise<any> {
    const cacheKey = `${this.cachePrefix}cites:${taxonId}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/taxon_concepts/${taxonId}/cites_legislation`,
        {
          headers: {
            'X-Authentication-Token': this.apiToken,
          },
          ...EXTERNAL_REQUEST_DEFAULTS,
        },
      );

      const data = response.data?.cites_listings || [];

      // Cache for 7 days
      await this.cacheService.set(cacheKey, JSON.stringify(data), 604800);

      return data;
    } catch (error) {
      this.logger.error(`Species+ CITES legislation error: ${describeHttpError(error)}`);
      return [];
    }
  }

  async getEULegislation(taxonId: number): Promise<any> {
    const cacheKey = `${this.cachePrefix}eu:${taxonId}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/taxon_concepts/${taxonId}/eu_legislation`,
        {
          headers: {
            'X-Authentication-Token': this.apiToken,
          },
          ...EXTERNAL_REQUEST_DEFAULTS,
        },
      );

      const data = response.data?.eu_listings || [];

      // Cache for 7 days
      await this.cacheService.set(cacheKey, JSON.stringify(data), 604800);

      return data;
    } catch (error) {
      this.logger.error(`Species+ EU legislation error: ${describeHttpError(error)}`);
      return [];
    }
  }

  async getDistributions(taxonId: number): Promise<any[]> {
    const cacheKey = `${this.cachePrefix}distribution:${taxonId}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/taxon_concepts/${taxonId}/distributions`,
        {
          headers: {
            'X-Authentication-Token': this.apiToken,
          },
          ...EXTERNAL_REQUEST_DEFAULTS,
        },
      );

      const data = response.data?.distributions || [];

      // Cache for 7 days
      await this.cacheService.set(cacheKey, JSON.stringify(data), 604800);

      return data;
    } catch (error) {
      this.logger.error(`Species+ distributions error: ${describeHttpError(error)}`);
      return [];
    }
  }
}
