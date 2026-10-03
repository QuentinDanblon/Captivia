/**
 * Formes des réponses Wikipedia consommées par le backend (champs lus uniquement).
 */

/** `action=query&list=search`. */
export interface WikipediaSearchResponse {
  query?: {
    search?: Array<{ title: string; pageid: number; snippet?: string }>;
  };
}

/** `/page/summary/{titre}` (API REST). */
export interface WikipediaSummary {
  title: string;
  pageid: number;
  error?: unknown;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
  extract?: string;
  extract_html?: string;
  originalimage?: { source?: string };
  terms?: Record<string, unknown>;
}

/** `action=query&prop=extracts`. */
export interface WikipediaExtractResponse {
  query?: {
    pages?: Record<
      string,
      { extract?: string; title: string; pageid: number } | undefined
    >;
  };
}

/** `action=parse&prop=text`. */
export interface WikipediaParseResponse {
  parse?: {
    text?: Record<string, string>;
    title: string;
    pageid: number;
  };
}

/** Réponse de l'endpoint « coordinates » (champs lus uniquement). */
export interface WikipediaCoordinatesResponse {
  query?: {
    pages?: Record<string, { coordinates?: unknown[] } | undefined>;
  };
}
