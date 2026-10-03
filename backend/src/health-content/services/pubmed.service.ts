import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { describeHttpError } from '../../external/http-safety';
import { ExternalHttpService } from '../../external/http/external-http.service';
import { upstreamUnavailable } from '../../external/http/external-errors';

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract?: string;
  authors: string[];
  journal: string;
  pubDate: string;
  url: string;
}

/** Les PMID renvoyés par PubMed sont numériques ; on ne réinjecte rien d'autre dans l'URL. */
const PMID_REGEX = /^\d{1,10}$/;

/**
 * PubMed (NCBI E-utilities) — API publique, SANS clé obligatoire (3 requêtes/s).
 * Clés optionnelles : `NCBI_API_KEY` (10 requêtes/s) et `NCBI_EMAIL` (contact recommandé
 * par NCBI). Sans clé, l'intégration reste active avec le quota public.
 *
 * Un échec (réseau, 5xx, disjoncteur ouvert) lève un 503 explicite : jamais de liste
 * vide « inventée » ni mise en cache à la suite d'une erreur. Les appelants qui
 * préfèrent dégrader (fiche santé) attrapent l'erreur.
 */
@Injectable()
export class PubmedService {
  private readonly logger = new Logger(PubmedService.name);
  private readonly baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly cachePrefix = 'pubmed:';

  constructor(
    private readonly cacheService: CacheService,
    private readonly http: ExternalHttpService,
  ) {}

  /** Paramètres d'identification NCBI (outil, e-mail et clé optionnels). */
  private ncbiParams(): Record<string, string> {
    const params: Record<string, string> = { tool: 'captivia' };
    const email = process.env.NCBI_EMAIL?.trim();
    const apiKey = process.env.NCBI_API_KEY?.trim();
    if (email) params.email = email;
    if (apiKey) params.api_key = apiKey;
    return params;
  }

  async searchArticles(
    query: string,
    maxResults = 10,
  ): Promise<PubMedArticle[]> {
    const cacheKey = `${this.cachePrefix}search:${query}:${maxResults}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      // Step 1: Search for PMIDs
      const searchResponse = await this.http.get(
        'pubmed',
        `${this.baseUrl}/esearch.fcgi`,
        {
          params: {
            db: 'pubmed',
            term: query,
            retmax: maxResults,
            retmode: 'json',
            ...this.ncbiParams(),
          },
        },
      );
      const pmids: string[] = (
        searchResponse.data?.esearchresult?.idlist || []
      ).filter((id: unknown) => typeof id === 'string' && PMID_REGEX.test(id));

      // Réponse valide « aucun article » : mise en cache (1 h, plus court qu'un résultat).
      if (pmids.length === 0) {
        await this.cacheService.set(cacheKey, JSON.stringify([]), 3600);
        return [];
      }

      // Step 2: Fetch article details
      const fetchResponse = await this.http.get(
        'pubmed',
        `${this.baseUrl}/esummary.fcgi`,
        {
          params: {
            db: 'pubmed',
            id: pmids.join(','),
            retmode: 'json',
            ...this.ncbiParams(),
          },
        },
      );
      const articles: PubMedArticle[] = [];

      for (const pmid of pmids) {
        const article = fetchResponse.data?.result?.[pmid];
        if (article) {
          articles.push({
            pmid,
            title: article.title || '',
            authors: article.authors?.map((a: any) => a.name) || [],
            journal: article.source || '',
            pubDate: article.pubdate || '',
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          });
        }
      }

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, JSON.stringify(articles), 86400);

      return articles;
    } catch (error) {
      this.logger.error(`PubMed search error: ${describeHttpError(error)}`);
      const stale = this.cacheService.getStale(cacheKey);
      if (typeof stale === 'string' && stale) {
        try {
          return JSON.parse(stale);
        } catch {
          /* entrée illisible : 503 ci-dessous */
        }
      }
      // Rien n'est écrit en cache après une erreur.
      throw upstreamUnavailable('PubMed temporarily unavailable');
    }
  }

  async getArticleAbstract(pmid: string): Promise<string | null> {
    if (!PMID_REGEX.test(pmid)) return null;
    const cacheKey = `${this.cachePrefix}abstract:${pmid}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached as string;
    }

    try {
      const response = await this.http.get(
        'pubmed',
        `${this.baseUrl}/efetch.fcgi`,
        {
          params: {
            db: 'pubmed',
            id: pmid,
            retmode: 'xml',
            ...this.ncbiParams(),
          },
        },
      );

      // Basic XML parsing (in production, use a proper XML parser)
      const abstractMatch = String(response.data).match(
        /<AbstractText[^>]*>(.*?)<\/AbstractText>/s,
      );
      const abstract = abstractMatch ? abstractMatch[1] : null;

      if (abstract) {
        // Cache for 7 days
        await this.cacheService.set(cacheKey, abstract, 604800);
      }

      return abstract;
    } catch (error) {
      this.logger.error(
        `PubMed abstract fetch error: ${describeHttpError(error)}`,
      );
      return null;
    }
  }

  async searchBySpeciesAndDisease(
    scientificName: string,
    disease?: string,
  ): Promise<PubMedArticle[]> {
    let query = `${scientificName}[Title/Abstract]`;

    if (disease) {
      query += ` AND (${disease}[Title/Abstract] OR disease[Title/Abstract] OR health[Title/Abstract])`;
    } else {
      query += ` AND (disease[Title/Abstract] OR health[Title/Abstract] OR pathology[Title/Abstract])`;
    }

    // Add filters for veterinary/animal health
    query += ' AND (veterinary[Title/Abstract] OR animal[Title/Abstract] OR reptile[Title/Abstract])';

    return this.searchArticles(query, 5);
  }
}
