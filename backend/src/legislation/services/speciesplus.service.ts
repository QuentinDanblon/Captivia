import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { describeHttpError } from '../../external/http-safety';
import { ExternalHttpService } from '../../external/http/external-http.service';
import {
  isUpstreamNotFound,
  upstreamUnavailable,
} from '../../external/http/external-errors';

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

type TaxonList = any[];

/**
 * Species+ (CITES / UE) — API qui EXIGE un jeton (`SPECIESPLUS_API_TOKEN`).
 * Sans jeton, l'intégration est désactivée proprement : `isConfigured()` est faux, les
 * routes `/speciesplus/*` répondent 503 `INTEGRATION_DISABLED` et la fiche législation
 * indique `speciesPlus.status = 'disabled'` — aucune donnée n'est inventée.
 *
 * Configurée, un échec (réseau, 5xx, disjoncteur ouvert) lève un 503 (ou sert la dernière
 * réponse connue, même périmée) : plus de liste vide « silencieuse », rien n'est mis en
 * cache après une erreur.
 */
@Injectable()
export class SpeciesPlusService {
  private readonly logger = new Logger(SpeciesPlusService.name);
  private readonly baseUrl = 'https://api.speciesplus.net/api/v1';
  private readonly cachePrefix = 'speciesplus:';

  constructor(
    private readonly cacheService: CacheService,
    private readonly http: ExternalHttpService,
  ) {}

  /** Jeton lu à l'appel (et non à l'import) : testable, et pris en compte après chargement du .env. */
  private get apiToken(): string {
    return process.env.SPECIESPLUS_API_TOKEN?.trim() || '';
  }

  isConfigured(): boolean {
    return this.apiToken.length > 0;
  }

  /** 503 explicite quand l'intégration n'est pas configurée (aucune donnée inventée). */
  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        message: 'Species+ integration is not configured',
        code: 'INTEGRATION_DISABLED',
      });
    }
  }

  private async fetchTaxon<T>(
    path: string,
    params: Record<string, unknown> | undefined,
  ) {
    return this.http.get<T>('speciesplus', `${this.baseUrl}${path}`, {
      params,
      headers: { 'X-Authentication-Token': this.apiToken },
    });
  }

  /**
   * Lecture avec cache : réponse valide → cache 7 j ; erreur → dernière valeur connue,
   * sinon 503 (jamais mise en cache). 404 du fournisseur : `notFound` (valeur « inconnu »).
   */
  private async cached<T>(
    cacheKey: string,
    label: string,
    load: () => Promise<T>,
    notFound: T,
  ): Promise<T> {
    this.assertConfigured();

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const data = await load();
      // Réponse valide uniquement (une liste vide valide est mise en cache ; `null` = rien).
      if (data !== null && data !== undefined) {
        await this.cacheService.set(cacheKey, JSON.stringify(data), 604800);
      }
      return data;
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        // Réponse valide « taxon inconnu » : pas une panne, pas de cache.
        return notFound;
      }
      this.logger.error(`Species+ ${label} error: ${describeHttpError(error)}`);
      const stale = this.cacheService.getStale(cacheKey);
      if (typeof stale === 'string' && stale) {
        try {
          return JSON.parse(stale);
        } catch {
          /* illisible : 503 ci-dessous */
        }
      }
      throw upstreamUnavailable('Species+ temporarily unavailable');
    }
  }

  async searchByScientificName(scientificName: string): Promise<TaxonList> {
    return this.cached<TaxonList>(
      `${this.cachePrefix}search:${scientificName}`,
      'search',
      async () => {
        const response = await this.fetchTaxon<any>('/taxon_concepts', {
          name: scientificName,
        });
        return response.data?.taxon_concepts || [];
      },
      [],
    );
  }

  async getTaxonDetails(taxonId: number): Promise<SpeciesPlusResponse | null> {
    return this.cached<SpeciesPlusResponse | null>(
      `${this.cachePrefix}taxon:${taxonId}`,
      'taxon details',
      async () => {
        const response = await this.fetchTaxon<any>(
          `/taxon_concepts/${taxonId}`,
          undefined,
        );
        return response.data?.taxon_concept ?? null;
      },
      null,
    );
  }

  async getCitesLegislation(taxonId: number): Promise<TaxonList> {
    return this.cached<TaxonList>(
      `${this.cachePrefix}cites:${taxonId}`,
      'CITES legislation',
      async () => {
        const response = await this.fetchTaxon<any>(
          `/taxon_concepts/${taxonId}/cites_legislation`,
          undefined,
        );
        return response.data?.cites_listings || [];
      },
      [],
    );
  }

  async getEULegislation(taxonId: number): Promise<TaxonList> {
    return this.cached<TaxonList>(
      `${this.cachePrefix}eu:${taxonId}`,
      'EU legislation',
      async () => {
        const response = await this.fetchTaxon<any>(
          `/taxon_concepts/${taxonId}/eu_legislation`,
          undefined,
        );
        return response.data?.eu_listings || [];
      },
      [],
    );
  }

  async getDistributions(taxonId: number): Promise<TaxonList> {
    return this.cached<TaxonList>(
      `${this.cachePrefix}distribution:${taxonId}`,
      'distributions',
      async () => {
        const response = await this.fetchTaxon<any>(
          `/taxon_concepts/${taxonId}/distributions`,
          undefined,
        );
        return response.data?.distributions || [];
      },
      [],
    );
  }
}
