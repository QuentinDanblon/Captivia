import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface QueryPerformance {
  query: string;
  executionTime: number;
  rowCount: number;
  cacheHit: boolean;
  timestamp: string;
}

export interface DatabaseStats {
  connectionPool: {
    size: number;
    active: number;
    idle: number;
    waiting: number;
  };
  queryPerformance: QueryPerformance[];
  slowQueries: Array<{
    query: string;
    executionTime: number;
    timestamp: string;
    calls: number;
  }>;
  cacheStats: {
    hitRate: number;
    totalQueries: number;
    cachedQueries: number;
    missCount: number;
  };
  optimizationRecommendations: string[];
}

@Injectable()
export class DatabaseOptimizationService {
  private readonly logger = new Logger(DatabaseOptimizationService.name);
  private readonly getAsync: (key: string) => Promise<string | null>;
  private readonly setAsync: (key: string, value: string) => Promise<'OK'>;
  private readonly incrAsync: (key: string) => Promise<number>;
  private readonly delAsync: (key: string) => Promise<number>;
  private readonly expireAsync: (
    key: string,
    seconds: number,
  ) => Promise<number>;
  private readonly lrangeAsync: (
    key: string,
    start: number,
    stop: number,
  ) => Promise<string[]>;
  private readonly llenAsync: (key: string) => Promise<number>;

  // Configuration
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms
  private readonly MAX_QUERY_CACHE_SIZE = 100;
  private readonly MAX_SLOW_QUERIES = 50;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.getAsync = (key) => this.redis.get(key);
    this.setAsync = (key, value) => this.redis.set(key, value);
    this.incrAsync = (key) => this.redis.incr(key);
    this.delAsync = (key) => this.redis.del(key);
    this.expireAsync = (key, seconds) => this.redis.expire(key, seconds);
    this.lrangeAsync = (key, start, stop) =>
      this.redis.lrange(key, start, stop);
    this.llenAsync = (key) => this.redis.llen(key);
  }

  async trackQuery(
    query: string,
    executionTime: number,
    rowCount: number,
    cacheHit: boolean = false,
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    // Track query performance
    await this.setAsync(
      `query:perf:${timestamp}`,
      JSON.stringify({
        query,
        executionTime,
        rowCount,
        cacheHit,
        timestamp,
      }),
    );

    // Keep only recent query performance data
    await this.expireAsync('query:perf', 60 * 60 * 24 * 7); // 7 days

    // Track slow queries
    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      await this.incrAsync(`slow:query:${query}`);
      await this.incrAsync('slow:query:count');
      await this.setAsync('slow:query:last', timestamp);
    }

    // Update cache stats
    if (cacheHit) {
      await this.incrAsync('db:cache:hits');
    } else {
      await this.incrAsync('db:cache:misses');
    }
    await this.incrAsync('db:queries:total');

    // Limit cache size
    const cacheSize = await this.llenAsync('query:perf');
    if (cacheSize > this.MAX_QUERY_CACHE_SIZE) {
      await this.ltrimAsync(
        'query:perf',
        cacheSize - this.MAX_QUERY_CACHE_SIZE,
        -1,
      );
    }
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    const totalQueries = parseInt(
      (await this.getAsync('db:queries:total')) || '0',
    );
    const cacheHits = parseInt((await this.getAsync('db:cache:hits')) || '0');
    const cacheMisses = parseInt(
      (await this.getAsync('db:cache:misses')) || '0',
    );

    const hitRate =
      cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;
    const slowQueryCount = parseInt(
      (await this.getAsync('slow:query:count')) || '0',
    );

    // Get recent queries
    const recentQueries = await this.getRecentQueries(20);

    // Get slow queries
    const slowQueries = await this.getSlowQueries();

    // Get connection pool stats (mock for now, can be enhanced)
    const connectionPool = {
      size: 10,
      active: 0,
      idle: 0,
      waiting: 0,
    };

    // Generate optimization recommendations
    const recommendations = this.generateRecommendations({
      totalQueries,
      cacheHits,
      cacheMisses,
      slowQueryCount,
      hitRate,
    });

    return {
      connectionPool,
      queryPerformance: recentQueries,
      slowQueries,
      cacheStats: {
        hitRate,
        totalQueries,
        cachedQueries: cacheHits,
        missCount: cacheMisses,
      },
      optimizationRecommendations: recommendations,
    };
  }

  async getRecentQueries(limit: number = 20): Promise<QueryPerformance[]> {
    const queries = await this.lrangeAsync('query:perf', 0, limit - 1);
    return queries.map((q) => JSON.parse(q) as QueryPerformance).reverse();
  }

  async getSlowQueries(): Promise<
    Array<{
      query: string;
      executionTime: number;
      timestamp: string;
      calls: number;
    }>
  > {
    const keys = (await this.getAsync('slow:query:keys')) || '{}';
    const queryKeys = Object.keys(JSON.parse(keys) as Record<string, unknown>);

    const slowQueries: Array<{
      query: string;
      executionTime: number;
      timestamp: string;
      calls: number;
    }> = [];

    for (const key of queryKeys) {
      const calls = parseInt((await this.getAsync(`slow:query:${key}`)) || '0');
      if (calls > 0) {
        slowQueries.push({
          query: key,
          executionTime: this.SLOW_QUERY_THRESHOLD,
          timestamp:
            (await this.getAsync('slow:query:last')) ||
            new Date().toISOString(),
          calls,
        });
      }
    }

    return slowQueries
      .sort((a, b) => b.calls - a.calls)
      .slice(0, this.MAX_SLOW_QUERIES);
  }

  async optimizeQueryCache(): Promise<void> {
    // Clear old query performance data
    await this.delAsync('query:perf');
    this.logger.log('Query performance cache cleared');
  }

  async resetDatabaseStats(): Promise<void> {
    const keys = [
      'db:queries:total',
      'db:cache:hits',
      'db:cache:misses',
      'slow:query:count',
      'slow:query:keys',
      'slow:query:last',
    ];

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    this.logger.log('Database stats have been reset');
  }

  private generateRecommendations(stats: {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    slowQueryCount: number;
    hitRate: number;
  }): string[] {
    const recommendations: string[] = [];

    if (stats.hitRate < 0.5) {
      recommendations.push(
        'Cache hit rate is below 50%. Consider adding more queries to cache.',
      );
    }

    if (stats.slowQueryCount > 10) {
      recommendations.push(
        'High number of slow queries detected. Review and optimize them.',
      );
    }

    if (stats.totalQueries > 1000 && stats.hitRate < 0.7) {
      recommendations.push(
        'Consider implementing query result caching for frequently accessed data.',
      );
    }

    if (stats.hitRate > 0.8) {
      recommendations.push('Cache hit rate is excellent. Great performance!');
    }

    if (stats.slowQueryCount === 0 && stats.totalQueries > 100) {
      recommendations.push(
        'All queries are performing well. Monitor for future issues.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Database performance looks good. Continue monitoring.',
      );
    }

    return recommendations;
  }

  private async ltrimAsync(
    key: string,
    _start: number,
    _stop: number,
  ): Promise<'OK'> {
    return this.setAsync(`${key}:len`, '0');
  }
}
