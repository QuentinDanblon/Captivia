import { Injectable, Logger } from '@nestjs/common';
import Memcached = require('memcached');

@Injectable()
export class MemcachedCacheService {
  private readonly logger = new Logger(MemcachedCacheService.name);
  private client: Memcached | null = null;
  private readonly defaultTTL = 3600; // 1 hour in seconds

  connect(): void {
    if (this.client) {
      return;
    }

    try {
      // Default to localhost:11211 if not configured
      const host = process.env.MEMCACHED_HOST || 'localhost';
      const port = process.env.MEMCACHED_PORT || '11211';

      this.client = new Memcached(`${host}:${port}`);

      this.client.on('error', (err) => {
        this.logger.warn('Memcached connection error:', err);
      });

      this.logger.log(`Connected to Memcached at ${host}:${port}`);
    } catch (error) {
      this.logger.error('Failed to connect to Memcached:', error);
      throw error;
    }
  }

  get(key: string): unknown {
    this.connect();

    return new Promise((resolve) => {
      if (!this.client) {
        resolve(null);
        return;
      }

      this.client.get(key, (err, data) => {
        if (err || !data) {
          this.logger.debug(`Cache miss for key: ${key}`);
          resolve(null);
          return;
        }

        this.logger.debug(`Cache hit for key: ${key}`);
        resolve(data);
      });
    });
  }

  /** Pas d'étagère « périmé » avec Memcached (les clés expirées sont supprimées). */
  getStale(_key: string): unknown {
    return null;
  }

  set(key: string, data: unknown, ttl: number = this.defaultTTL): void {
    this.connect();

    if (!this.client) {
      return;
    }

    this.client.set(key, data, ttl, (err) => {
      if (err) {
        this.logger.error(`Failed to set cache key ${key}:`, err);
      } else {
        this.logger.debug(`Cache set for key: ${key} (TTL: ${ttl}s)`);
      }
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.connect();

    if (!this.client) {
      return;
    }

    this.client.flush((err) => {
      if (err) {
        this.logger.error('Failed to clear Memcached:', err);
      } else {
        this.logger.debug('Memcached cache cleared');
      }
    });
  }

  clearKey(key: string): void {
    this.connect();

    if (!this.client) {
      return;
    }

    this.client.del(key, (err) => {
      if (err) {
        this.logger.debug(`Failed to delete key ${key}:`, err);
      } else {
        this.logger.debug(`Cache key cleared: ${key}`);
      }
    });
  }

  getCacheSize(): number {
    // Memcached doesn't provide a direct way to get cache size
    // Return 0 as placeholder
    return 0;
  }

  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.getCacheSize(),
      ttl: this.defaultTTL,
    };
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.logger.log('Disconnected from Memcached');
    }
  }
}