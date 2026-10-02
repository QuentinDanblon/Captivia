import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../../cache/cache.service';
import {
  EXTERNAL_REQUEST_DEFAULTS,
  describeHttpError,
} from '../../external/http-safety';

interface PubMedArticle {
  pmid: string;
  title: string;
  abstract?: string;
  authors: string[];
  journal: string;
  pubDate: string;
  url: string;
}

@Injectable()
export class PubmedService {
  private readonly logger = new Logger(PubmedService.name);
  private readonly baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly cachePrefix = 'pubmed:';

  constructor(private readonly cacheService: CacheService) {}

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
      const searchUrl = `${this.baseUrl}/esearch.fcgi`;
      const searchParams = {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        retmode: 'json',
        usehistory: 'y',
      };

      const searchResponse = await axios.get(searchUrl, {
        params: searchParams,
        ...EXTERNAL_REQUEST_DEFAULTS,
      });
      const pmids = searchResponse.data.esearchresult?.idlist || [];

      if (pmids.length === 0) {
        return [];
      }

      // Step 2: Fetch article details
      const fetchUrl = `${this.baseUrl}/esummary.fcgi`;
      const fetchParams = {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'json',
      };

      const fetchResponse = await axios.get(fetchUrl, {
        params: fetchParams,
        ...EXTERNAL_REQUEST_DEFAULTS,
      });
      const articles: PubMedArticle[] = [];

      for (const pmid of pmids) {
        const article = fetchResponse.data.result?.[pmid];
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
      return [];
    }
  }

  async getArticleAbstract(pmid: string): Promise<string | null> {
    const cacheKey = `${this.cachePrefix}abstract:${pmid}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached as string;
    }

    try {
      const fetchUrl = `${this.baseUrl}/efetch.fcgi`;
      const params = {
        db: 'pubmed',
        id: pmid,
        retmode: 'xml',
      };

      const response = await axios.get(fetchUrl, {
        params,
        ...EXTERNAL_REQUEST_DEFAULTS,
      });
      
      // Basic XML parsing (in production, use a proper XML parser)
      const abstractMatch = response.data.match(
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
