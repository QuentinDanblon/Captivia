import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  errorsByType: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  activeConnections: number;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly getAsync: (key: string) => Promise<string | null>;
  private readonly setAsync: (key: string, value: string) => Promise<'OK'>;
  private readonly incrAsync: (key: string) => Promise<number>;
  private readonly expireAsync: (
    key: string,
    seconds: number,
  ) => Promise<number>;
  private readonly delAsync: (key: string) => Promise<number>;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.getAsync = (key) => this.redis.get(key);
    this.setAsync = (key, value) => this.redis.set(key, value);
    this.incrAsync = (key) => this.redis.incr(key);
    this.expireAsync = (key, seconds) => this.redis.expire(key, seconds);
    this.delAsync = (key) => this.redis.del(key);
  }

  onModuleInit(): void {
    // Volontairement non attendu : le préchauffage ne doit pas retarder le démarrage
    // (et `initializeMetrics` absorbe déjà les erreurs de chaque lecture).
    void this.initializeMetrics();
  }

  private async initializeMetrics() {
    const keys = [
      'metrics:total',
      'metrics:successful',
      'metrics:failed',
      'metrics:responseTime',
      'metrics:cacheHits',
      'metrics:cacheMisses',
    ];

    for (const key of keys) {
      await this.getAsync(key).catch(() => {});
    }
  }

  async incrementRequest(endpoint: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.incr('metrics:total');
    pipeline.incr(`metrics:endpoints:${endpoint}`);
    await pipeline.exec();
  }

  async incrementSuccessfulRequest(): Promise<void> {
    await this.incrAsync('metrics:successful');
  }

  async incrementFailedRequest(): Promise<void> {
    await this.incrAsync('metrics:failed');
  }

  async recordResponseTime(duration: number): Promise<void> {
    const current = (await this.getAsync('metrics:responseTime')) || '0';
    const sum = parseInt(current) + duration;
    const count = (await this.getAsync('metrics:responseTimeCount')) || '0';
    const avg = Math.round(sum / (parseInt(count) + 1));

    await this.setAsync('metrics:responseTime', avg.toString());
    await this.setAsync(
      'metrics:responseTimeCount',
      (parseInt(count) + 1).toString(),
    );
  }

  async recordCacheHit(): Promise<void> {
    await this.incrAsync('metrics:cacheHits');
  }

  async recordCacheMiss(): Promise<void> {
    await this.incrAsync('metrics:cacheMisses');
  }

  async getMetrics(): Promise<Metrics> {
    const total = (await this.getAsync('metrics:total')) || '0';
    const successful = (await this.getAsync('metrics:successful')) || '0';
    const failed = (await this.getAsync('metrics:failed')) || '0';
    const avgResponseTime =
      (await this.getAsync('metrics:responseTime')) || '0';
    const cacheHits = (await this.getAsync('metrics:cacheHits')) || '0';
    const cacheMisses = (await this.getAsync('metrics:cacheMisses')) || '0';

    // Get endpoints
    const endpoints = (await this.getAsync('metrics:endpoints')) || '{}';
    const requestsByEndpoint = JSON.parse(endpoints) as Record<string, number>;

    // Get errors by type
    const errors = (await this.getAsync('metrics:errors')) || '{}';
    const errorsByType = JSON.parse(errors) as Record<string, number>;

    return {
      totalRequests: parseInt(total),
      successfulRequests: parseInt(successful),
      failedRequests: parseInt(failed),
      averageResponseTime: parseInt(avgResponseTime),
      requestsByEndpoint,
      errorsByType,
      cacheHits: parseInt(cacheHits),
      cacheMisses: parseInt(cacheMisses),
      activeConnections: 0, // Can be enhanced with connection pool metrics
    };
  }

  async resetMetrics(): Promise<void> {
    const keys = [
      'metrics:total',
      'metrics:successful',
      'metrics:failed',
      'metrics:responseTime',
      'metrics:responseTimeCount',
      'metrics:cacheHits',
      'metrics:cacheMisses',
      'metrics:endpoints',
      'metrics:errors',
    ];

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    this.logger.log('Metrics have been reset');
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memoryUsage: number;
    redisConnected: boolean;
    metrics: Metrics;
  }> {
    const metrics = await this.getMetrics();
    const redisConnected = this.redis.status === 'ready';

    const errorRate =
      metrics.totalRequests > 0
        ? metrics.failedRequests / metrics.totalRequests
        : 0;

    const cacheHitRate =
      metrics.cacheHits + metrics.cacheMisses > 0
        ? metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
        : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (errorRate > 0.1 || !redisConnected) {
      status = 'unhealthy';
    } else if (errorRate > 0.05 || cacheHitRate < 0.5) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed,
      redisConnected,
      metrics,
    };
  }
}
