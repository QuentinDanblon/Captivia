import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      db: redisDb,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error:', error);
    });
  }

  async get(key: string): Promise<unknown> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /** Pas d'étagère « périmé » avec Redis (les clés expirées sont supprimées). */
  getStale(_key: string): unknown {
    return null;
  }

  async set(key: string, data: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      const expiry = ttl || parseInt(process.env.CACHE_TTL || '3600', 10);
      await this.client.setex(key, expiry, serialized);
      this.logger.debug(`Cache set for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.logger.debug(`Cache key deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushdb();
      this.logger.debug('Cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking key ${key}:`, error);
      return false;
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const info = await this.client.info('memory');
      const match = info.match(/used_memory_human:\s*(\S+)/);
      return match ? parseInt(match[1].replace(/[MG]/, ''), 10) : 0;
    } catch (error) {
      this.logger.error('Error getting cache size:', error);
      return 0;
    }
  }

  async getCacheStats(): Promise<{ size: number; ttl: number }> {
    try {
      const info = await this.client.info('keyspace');
      const match = info.match(/db\d+:keys=(\d+)/);
      const size = match ? parseInt(match[1], 10) : 0;
      const ttl = parseInt(process.env.CACHE_TTL || '3600', 10);

      return { size, ttl };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { size: 0, ttl: 3600 };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis:', error);
    }
  }
}