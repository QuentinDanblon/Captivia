/**
 * Configuration du cache avec TTL personnalisé par type de données
 * Source: plans/resource-improvement-plan.md
 */

export interface CacheConfig {
  species: number; // 24h = 86400 secondes
  media: number; // 1h = 3600 secondes
  distributions: number; // 24h = 86400 secondes
  vernacular: number; // 12h = 43200 secondes
  metrics: number; // 7j = 604800 secondes
  search: number; // 1h = 3600 secondes
}

export const CACHE_CONFIG: CacheConfig = {
  species: parseInt(process.env.CACHE_TTL_SPECIES || '86400', 10),
  media: parseInt(process.env.CACHE_TTL_MEDIA || '3600', 10),
  distributions: parseInt(process.env.CACHE_TTL_DISTRIBUTIONS || '86400', 10),
  vernacular: parseInt(process.env.CACHE_TTL_VERNACULAR || '43200', 10),
  metrics: parseInt(process.env.CACHE_TTL_METRICS || '604800', 10),
  search: parseInt(process.env.CACHE_TTL_SEARCH || '3600', 10),
};

/**
 * Obtient le TTL pour une clé spécifique
 */
export function getCacheTTL(key: string): number {
  if (key.startsWith('species:')) return CACHE_CONFIG.species;
  if (key.startsWith('media:')) return CACHE_CONFIG.media;
  if (key.startsWith('distributions:')) return CACHE_CONFIG.distributions;
  if (key.startsWith('vernacular:')) return CACHE_CONFIG.vernacular;
  if (key.startsWith('metrics:')) return CACHE_CONFIG.metrics;
  if (key.startsWith('search:')) return CACHE_CONFIG.search;
  if (key.startsWith('occurrences:')) return CACHE_CONFIG.metrics;
  return CACHE_CONFIG.species; // Valeur par défaut
}

/**
 * Obtient le TTL par défaut
 */
export function getDefaultCacheTTL(): number {
  return CACHE_CONFIG.species;
}
