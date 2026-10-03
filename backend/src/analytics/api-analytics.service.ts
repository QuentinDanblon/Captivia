import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createHash } from 'crypto';

/** Durée de vie des compteurs journaliers et des ensembles d'utilisateurs (W2-08) : 90 jours. */
export const ANALYTICS_DAILY_TTL_SECONDS = 90 * 24 * 60 * 60;

/** Pseudonyme stable d'un utilisateur pour le comptage des visiteurs uniques (jamais l'id brut). */
export function analyticsUserKey(userId: string): string {
  return createHash('sha256')
    .update(`analytics:${userId}`)
    .digest('hex')
    .slice(0, 32);
}

export interface ApiUsage {
  totalRequests: number;
  uniqueUsers: number;
  requestsByDay: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  averageResponseTime: number;
  peakTrafficTime: string;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  errorRate: number;
  cacheHitRate: number;
  avgResponseTimeByEndpoint: Record<string, number>;
}

export interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  endpoint?: string;
  userId?: string;
}

@Injectable()
export class ApiAnalyticsService {
  private readonly logger = new Logger(ApiAnalyticsService.name);
  private readonly getAsync: (key: string) => Promise<string | null>;
  private readonly setAsync: (key: string, value: string) => Promise<'OK'>;
  private readonly incrAsync: (key: string) => Promise<number>;
  private readonly incrByAsync: (
    key: string,
    amount: number,
  ) => Promise<number>;
  private readonly delAsync: (key: string) => Promise<number>;
  private readonly lpushAsync: (
    key: string,
    ...values: string[]
  ) => Promise<number>;
  private readonly lrangeAsync: (
    key: string,
    start: number,
    stop: number,
  ) => Promise<string[]>;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.getAsync = (key) => this.redis.get(key);
    this.setAsync = (key, value) => this.redis.set(key, value);
    this.incrAsync = (key) => this.redis.incr(key);
    this.incrByAsync = (key, increment) => this.redis.incrby(key, increment);
    this.delAsync = (key) => this.redis.del(key);
    this.lpushAsync = (key, ...values) => this.redis.lpush(key, ...values);
    this.lrangeAsync = (key, start, stop) =>
      this.redis.lrange(key, start, stop);
  }

  /**
   * `userId` provient du JWT (null = appel anonyme, non compté dans les visiteurs uniques).
   * Seul un pseudonyme (sha256 tronqué) est stocké ; les clés journalières expirent après 90 jours.
   */
  async trackRequest(
    endpoint: string,
    userId: string | null,
    duration: number,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Track total requests
    pipeline.incr('analytics:totalRequests');

    // Track requests by endpoint
    pipeline.incr(`analytics:endpoints:${endpoint}`);

    // Track requests by day
    const today = new Date().toISOString().split('T')[0];
    pipeline.incr(`analytics:daily:${today}:${endpoint}`);
    pipeline.expire(
      `analytics:daily:${today}:${endpoint}`,
      ANALYTICS_DAILY_TTL_SECONDS,
    );

    // Track response time
    const currentAvg =
      (await this.getAsync(`analytics:avgResponseTime:${endpoint}`)) || '0';
    const sum = parseInt(currentAvg) + duration;
    const count =
      (await this.getAsync(`analytics:responseTimeCount:${endpoint}`)) || '0';
    const avg = Math.round(sum / (parseInt(count) + 1));
    pipeline.set(`analytics:avgResponseTime:${endpoint}`, avg.toString());
    pipeline.set(
      `analytics:responseTimeCount:${endpoint}`,
      (parseInt(count) + 1).toString(),
    );

    // Track unique users (pseudonymisés ; les appels anonymes ne sont pas comptés)
    if (userId) {
      pipeline.sadd(`analytics:users:${today}`, analyticsUserKey(userId));
      pipeline.expire(`analytics:users:${today}`, ANALYTICS_DAILY_TTL_SECONDS);
    }

    // Track error if duration is too high (threshold: 5 seconds)
    if (duration > 5000) {
      pipeline.incr(`analytics:errors:${endpoint}`);
    }

    await pipeline.exec();
  }

  async getAnalytics(query: AnalyticsQuery = {}): Promise<ApiUsage> {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      endpoint,
    } = query;

    const totalRequests = parseInt(
      (await this.getAsync('analytics:totalRequests')) || '0',
    );

    // Get unique users for the period
    const uniqueUsers = await this.redis.scard(`analytics:users:${endDate}`);

    // Get requests by day
    const requestsByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `analytics:daily:${dateStr}`;
      const count = (await this.getAsync(key)) || '0';
      requestsByDay[dateStr] = parseInt(count);
    }

    // Get requests by endpoint
    const endpointsKey = endpoint
      ? `analytics:endpoints:${endpoint}`
      : 'analytics:endpoints';
    const endpoints = (await this.getAsync(endpointsKey)) || '{}';
    const requestsByEndpoint = JSON.parse(endpoints);

    // Get top endpoints
    const topEndpoints = Object.entries(requestsByEndpoint)
      .map(([endpoint, count]) => ({
        endpoint,
        count: parseInt(count as string),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get average response time by endpoint
    const avgResponseTimeByEndpoint: Record<string, number> = {};
    for (const [ep] of Object.entries(requestsByEndpoint)) {
      const avg =
        (await this.getAsync(`analytics:avgResponseTime:${ep}`)) || '0';
      avgResponseTimeByEndpoint[ep] = parseInt(avg);
    }

    // Get error rate
    const errorsKey = endpoint
      ? `analytics:errors:${endpoint}`
      : 'analytics:errors';
    const errors = parseInt((await this.getAsync(errorsKey)) || '0');
    const errorRate = totalRequests > 0 ? errors / totalRequests : 0;

    // Get cache hit rate
    const cacheHits = parseInt(
      (await this.getAsync('analytics:cacheHits')) || '0',
    );
    const cacheMisses = parseInt(
      (await this.getAsync('analytics:cacheMisses')) || '0',
    );
    const cacheHitRate =
      cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

    // Determine peak traffic time
    const peakTime = (await this.getAsync('analytics:peakTime')) || '00:00';
    const peakCount = (await this.getAsync('analytics:peakCount')) || '0';

    // Get overall average response time
    const overallAvg =
      (await this.getAsync('analytics:avgResponseTime')) || '0';

    return {
      totalRequests,
      uniqueUsers,
      requestsByDay,
      requestsByEndpoint,
      averageResponseTime: parseInt(overallAvg),
      peakTrafficTime: peakTime,
      topEndpoints,
      errorRate,
      cacheHitRate,
      avgResponseTimeByEndpoint,
    };
  }

  async getDailyReport(date: string): Promise<{
    date: string;
    requests: number;
    uniqueUsers: number;
    avgResponseTime: number;
    errors: number;
    cacheHitRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  }> {
    const requests = parseInt(
      (await this.getAsync(`analytics:daily:${date}`)) || '0',
    );
    const uniqueUsers = await this.redis.scard(`analytics:users:${date}`);
    const avgResponseTime = parseInt(
      (await this.getAsync(`analytics:avgResponseTime:${date}`)) || '0',
    );
    const errors = parseInt(
      (await this.getAsync(`analytics:errors:${date}`)) || '0',
    );

    const cacheHits = parseInt(
      (await this.getAsync('analytics:cacheHits')) || '0',
    );
    const cacheMisses = parseInt(
      (await this.getAsync('analytics:cacheMisses')) || '0',
    );
    const cacheHitRate =
      cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

    const endpoints =
      (await this.getAsync(`analytics:endpoints:${date}`)) || '{}';
    const topEndpoints = Object.entries(JSON.parse(endpoints))
      .map(([endpoint, count]) => ({
        endpoint,
        count: parseInt(count as string),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      date,
      requests,
      uniqueUsers,
      avgResponseTime,
      errors,
      cacheHitRate,
      topEndpoints,
    };
  }

  async exportReport(
    date: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    const data = await this.getDailyReport(date);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    const headers = [
      'Date',
      'Requests',
      'Unique Users',
      'Avg Response Time (ms)',
      'Errors',
      'Cache Hit Rate',
      'Top Endpoints',
    ];
    const rows = [
      headers.join(','),
      [
        data.date,
        data.requests,
        data.uniqueUsers,
        data.avgResponseTime,
        data.errors,
        `${(data.cacheHitRate * 100).toFixed(2)}%`,
        data.topEndpoints.map((e) => e.endpoint).join('; '),
      ].join(','),
    ];

    return rows.join('\n');
  }

  async resetAnalytics(): Promise<void> {
    const keys = [
      'analytics:totalRequests',
      'analytics:avgResponseTime',
      'analytics:responseTimeCount',
      'analytics:cacheHits',
      'analytics:cacheMisses',
      'analytics:errors',
      'analytics:peakTime',
      'analytics:peakCount',
    ];

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    this.logger.log('Analytics data has been reset');
  }

  async getTrafficTrend(days: number = 7): Promise<
    Array<{
      date: string;
      requests: number;
      uniqueUsers: number;
      avgResponseTime: number;
    }>
  > {
    const trend: Array<{
      date: string;
      requests: number;
      uniqueUsers: number;
      avgResponseTime: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const requests = parseInt(
        (await this.getAsync(`analytics:daily:${dateStr}`)) || '0',
      );
      const uniqueUsers = await this.redis.scard(`analytics:users:${dateStr}`);
      const avgResponseTime = parseInt(
        (await this.getAsync(`analytics:avgResponseTime:${dateStr}`)) || '0',
      );

      trend.push({
        date: dateStr,
        requests,
        uniqueUsers,
        avgResponseTime,
      });
    }

    return trend;
  }
}
