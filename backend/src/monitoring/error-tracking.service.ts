import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  type?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  endpoint?: string;
  userAgent?: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  recentErrors: ErrorLog[];
  errorRate: number;
  topErrors: Array<{ type: string; count: number; lastOccurrence: string }>;
}

@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private readonly getAsync: (key: string) => Promise<string | null>;
  private readonly setAsync: (key: string, value: string) => Promise<'OK'>;
  private readonly lpushAsync: (
    key: string,
    ...values: string[]
  ) => Promise<number>;
  private readonly lrangeAsync: (
    key: string,
    start: number,
    stop: number,
  ) => Promise<string[]>;
  private readonly llenAsync: (key: string) => Promise<number>;
  private readonly incrAsync: (key: string) => Promise<number>;
  private readonly delAsync: (key: string) => Promise<number>;
  private readonly expireAsync: (
    key: string,
    seconds: number,
  ) => Promise<number>;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.getAsync = (key) => this.redis.get(key);
    this.setAsync = (key, value) => this.redis.set(key, value);
    this.lpushAsync = (key, ...values) => this.redis.lpush(key, ...values);
    this.lrangeAsync = (key, start, stop) =>
      this.redis.lrange(key, start, stop);
    this.llenAsync = (key) => this.redis.llen(key);
    this.incrAsync = (key) => this.redis.incr(key);
    this.delAsync = (key) => this.redis.del(key);
    this.expireAsync = (key, seconds) => this.redis.expire(key, seconds);
  }

  async logError(
    errorData: Omit<ErrorLog, 'id' | 'timestamp'>,
  ): Promise<string> {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();

    const errorLog: ErrorLog = {
      ...errorData,
      id: errorId,
      timestamp,
    };

    // Store error log in Redis list (keep last 1000 errors)
    await this.lpushAsync('errors:logs', JSON.stringify(errorLog));
    await this.expireAsync('errors:logs', 60 * 60 * 24 * 30); // 30 days

    // Update error stats
    const pipeline = this.redis.pipeline();
    pipeline.incr('errors:total');
    pipeline.incr(`errors:types:${errorData.type}`);
    pipeline.incr(`errors:endpoints:${errorData.endpoint || 'unknown'}`);
    pipeline.set('errors:lastError', timestamp);
    await pipeline.exec();

    // Log to console
    if (errorData.level === 'error') {
      this.logger.error(errorData.message, errorData.stack, errorData.context);
    } else if (errorData.level === 'warning') {
      this.logger.warn(errorData.message, errorData.context);
    }

    return errorId;
  }

  async getErrorStats(): Promise<ErrorStats> {
    const totalErrors = parseInt((await this.getAsync('errors:total')) || '0');
    const lastError =
      (await this.getAsync('errors:lastError')) || new Date().toISOString();

    // Get errors by type
    const types = (await this.getAsync('errors:types')) || '{}';
    const errorsByType = JSON.parse(types) as Record<string, number>;

    // Get errors by endpoint
    const endpoints = (await this.getAsync('errors:endpoints')) || '{}';
    const errorsByEndpoint = JSON.parse(endpoints) as Record<string, number>;

    // Get top errors
    const topErrors = Object.entries(errorsByType)
      .map(([type, count]) => ({ type, count: parseInt(String(count)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((e) => ({
        ...e,
        lastOccurrence: lastError,
      }));

    // Get recent errors
    const recentErrors = await this.getRecentErrors(50);

    // Calculate error rate (errors per 1000 requests)
    const errorRate = totalErrors / 1000;

    return {
      totalErrors,
      errorsByType,
      errorsByEndpoint,
      recentErrors,
      errorRate,
      topErrors,
    };
  }

  async getRecentErrors(limit: number = 50): Promise<ErrorLog[]> {
    const errors = await this.lrangeAsync('errors:logs', 0, limit - 1);
    return errors.map((err) => JSON.parse(err) as ErrorLog).reverse();
  }

  async getErrorById(id: string): Promise<ErrorLog | null> {
    const errors = await this.getRecentErrors(1000);
    return errors.find((e) => e.id === id) || null;
  }

  async clearOldErrors(days: number = 7): Promise<void> {
    const errors = await this.getRecentErrors(1000);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filteredErrors = errors.filter(
      (e) => new Date(e.timestamp) > cutoffDate,
    );

    // Rebuild the error log list
    const pipeline = this.redis.pipeline();
    pipeline.del('errors:logs');

    filteredErrors.forEach((error) => {
      pipeline.lpush('errors:logs', JSON.stringify(error));
    });

    await pipeline.exec();
    this.logger.log(`Cleared errors older than ${days} days`);
  }

  async exportErrors(
    format: 'json' | 'csv' = 'json',
    days: number = 7,
  ): Promise<string> {
    const errors = await this.getRecentErrors(1000);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filteredErrors = errors.filter(
      (e) => new Date(e.timestamp) > cutoffDate,
    );

    if (format === 'json') {
      return JSON.stringify(filteredErrors, null, 2);
    }

    // CSV format
    const headers = [
      'ID',
      'Timestamp',
      'Level',
      'Type',
      'Message',
      'Endpoint',
      'User ID',
      'Context',
    ];
    const rows = filteredErrors.map((e) => [
      e.id,
      e.timestamp,
      e.level,
      e.type,
      `"${e.message.replace(/"/g, '""')}"`,
      e.endpoint || '',
      e.userId || '',
      e.context ? JSON.stringify(e.context).replace(/"/g, '""') : '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async resetErrorTracking(): Promise<void> {
    const keys = [
      'errors:total',
      'errors:types',
      'errors:endpoints',
      'errors:lastError',
      'errors:logs',
    ];

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    this.logger.log('Error tracking data has been reset');
  }

  private generateErrorId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Convenience methods for logging different error levels
  async logInfo(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<string> {
    return this.logError({ level: 'info', message, context });
  }

  async logWarning(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<string> {
    return this.logError({ level: 'warning', message, context });
  }

  async logErrorMethod(
    message: string,
    stack?: string,
    context?: Record<string, unknown>,
  ): Promise<string> {
    return this.logError({ level: 'error', message, stack, context });
  }
}
