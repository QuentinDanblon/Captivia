import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { getCacheTTL, getDefaultCacheTTL } from './cache.config';

/** Nombre maximal d'entrées en mémoire (éviction LRU au-delà). */
export const CACHE_MAX_ENTRIES = 5000;
/**
 * Durée (secondes) pendant laquelle une entrée EXPIRÉE reste consultable via `getStale`
 * (repli quand un fournisseur externe est indisponible). Jamais servie par `get`.
 */
export const CACHE_STALE_GRACE_SECONDS = 7 * 24 * 3600;
/** Les clés plus longues sont remplacées par leur empreinte SHA-1. */
export const CACHE_MAX_KEY_LENGTH = 200;

interface CacheEntry {
  data: unknown;
  /** Date d'expiration absolue (ms epoch), calculée à l'écriture. */
  expiresAt: number;
  /** Au-delà, l'entrée n'est plus servie même en repli (`getStale`). */
  staleUntil: number;
}

/**
 * Clé effectivement stockée : les clés > 200 caractères (ex. recherches libres)
 * sont hachées pour borner la mémoire consommée par les clés.
 */
export function normalizeCacheKey(key: string): string {
  if (key.length <= CACHE_MAX_KEY_LENGTH) return key;
  return `sha1:${createHash('sha1').update(key).digest('hex')}`;
}

/**
 * Cache mémoire LRU borné.
 * - au plus CACHE_MAX_ENTRIES entrées : la moins récemment utilisée est évincée ;
 * - `expiresAt` est calculé une fois à l'écriture (le TTL ne dépend plus de la lecture) ;
 * - `set(key, data, ttlSeconds)` : le TTL personnalisé est exprimé en SECONDES
 *   (même unité que Redis/Memcached et que CACHE_TTL_*) ; à défaut, TTL selon le préfixe de la clé.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  /** Map ordonnée par récence d'usage : première clé = la moins récemment utilisée. */
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtl: number;

  constructor(private configService: ConfigService) {
    // Use default TTL from config
    this.defaultTtl = getDefaultCacheTTL() * 1000;
  }

  get(key: string): unknown {
    const storeKey = normalizeCacheKey(key);
    const item = this.cache.get(storeKey);
    if (!item) {
      this.logger.debug(`Cache miss for key: ${storeKey}`);
      return null;
    }

    if (item.expiresAt <= Date.now()) {
      this.logger.debug(`Cache expired for key: ${storeKey}`);
      // Conservée pour `getStale` jusqu'à la fin de la période de grâce.
      if (item.staleUntil <= Date.now()) this.cache.delete(storeKey);
      return null;
    }

    // LRU : l'entrée consultée devient la plus récente.
    this.cache.delete(storeKey);
    this.cache.set(storeKey, item);

    this.logger.debug(`Cache hit for key: ${storeKey}`);
    return item.data;
  }

  /**
   * Valeur la plus récente connue, MÊME EXPIRÉE (dans la période de grâce) : repli
   * lorsque le fournisseur externe est en panne. À n'utiliser qu'après un échec de `get`
   * + de l'appel externe ; ne rafraîchit ni le TTL ni la position LRU.
   */
  getStale(key: string): unknown {
    const storeKey = normalizeCacheKey(key);
    const item = this.cache.get(storeKey);
    if (!item) return null;
    if (item.staleUntil <= Date.now()) {
      this.cache.delete(storeKey);
      return null;
    }
    return item.data;
  }

  /**
   * @param customTtl TTL en SECONDES (optionnel). Ignoré s'il n'est pas un nombre fini > 0 ;
   *                  à défaut, le TTL dépend du préfixe de la clé (cache.config.ts).
   */
  set(key: string, data: unknown, customTtl?: number): void {
    const storeKey = normalizeCacheKey(key);
    const ttlSeconds =
      typeof customTtl === 'number' &&
      Number.isFinite(customTtl) &&
      customTtl > 0
        ? customTtl
        : getCacheTTL(key);

    // Réécriture : repositionne la clé en fin de Map (la plus récente).
    this.cache.delete(storeKey);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(storeKey, {
      data,
      expiresAt,
      staleUntil: expiresAt + CACHE_STALE_GRACE_SECONDS * 1000,
    });

    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
    this.logger.debug(`Cache set for key: ${storeKey} (TTL: ${ttlSeconds}s)`);
  }

  has(key: string): boolean {
    const storeKey = normalizeCacheKey(key);
    const item = this.cache.get(storeKey);
    if (!item) return false;

    if (item.expiresAt <= Date.now()) {
      if (item.staleUntil <= Date.now()) this.cache.delete(storeKey);
      return false;
    }

    return true;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Cache cleared (${size} items removed)`);
  }

  clearKey(key: string): void {
    const storeKey = normalizeCacheKey(key);
    if (this.cache.delete(storeKey)) {
      this.logger.debug(`Cache key cleared: ${storeKey}`);
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheStats(): {
    size: number;
    maxEntries: number;
    ttl: number;
    defaultTtl: number;
    ttlConfig: Record<string, number>;
  } {
    return {
      size: this.cache.size,
      maxEntries: CACHE_MAX_ENTRIES,
      ttl: this.defaultTtl / 1000,
      defaultTtl: this.defaultTtl / 1000,
      ttlConfig: {
        species: getCacheTTL('species:12345'),
        media: getCacheTTL('media:12345'),
        distributions: getCacheTTL('distributions:12345'),
        vernacular: getCacheTTL('vernacular:12345'),
        metrics: getCacheTTL('metrics:12345'),
        search: getCacheTTL('search:test'),
        occurrences: getCacheTTL('occurrences:12345'),
      },
    };
  }
}
