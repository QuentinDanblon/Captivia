# Monitoring & Analytics Module

This module provides comprehensive monitoring, analytics, and error tracking capabilities for the Captivia application.

## Overview

The monitoring system includes:
- **Performance Metrics**: Track request counts, response times, cache hits/misses
- **API Analytics**: Monitor usage patterns, traffic trends, and performance metrics
- **Error Tracking**: Log and analyze errors with detailed context
- **Database Optimization**: Query performance tracking and recommendations

## Modules

### 1. Metrics Service (`metrics.service.ts`)

Tracks system-level performance metrics.

**Endpoints:**
- `GET /monitoring/metrics` - Get system metrics
- `GET /monitoring/health` - Get health status
- `DELETE /monitoring/reset` - Reset all metrics

**Metrics tracked:**
- Total requests
- Successful/failed requests
- Average response time
- Requests by endpoint
- Errors by type
- Cache hits/misses

### 2. API Analytics Service (`api-analytics.service.ts`)

Analyzes API usage patterns and traffic.

**Endpoints:**
- `GET /analytics` - Get API usage analytics
- `GET /analytics/daily/:date` - Get daily report
- `GET /analytics/traffic-trend` - Get traffic trend
- `POST /analytics/track` - Track API request
- `GET /analytics/export/:date` - Export analytics report
- `DELETE /analytics/reset` - Reset analytics data

**Features:**
- Daily request tracking
- User activity monitoring
- Response time analysis
- Endpoint performance tracking
- Traffic trend analysis
- Report export (JSON/CSV)

### 3. Error Tracking Service (`error-tracking.service.ts`)

Logs and analyzes application errors.

**Endpoints:**
- `GET /errors/stats` - Get error statistics
- `GET /errors/recent` - Get recent errors
- `GET /errors/:id` - Get error by ID
- `DELETE /errors/clear` - Clear old errors
- `GET /errors/export` - Export errors
- `DELETE /errors/reset` - Reset error tracking

**Features:**
- Error logging with context
- Error type categorization
- Endpoint-specific error tracking
- Error rate calculation
- Error export (JSON/CSV)
- Automatic cleanup

### 4. Database Optimization Service (`database-optimization.service.ts`)

Monitors database query performance.

**Endpoints:**
- `GET /database/stats` - Get database stats
- `POST /database/optimize-cache` - Optimize query cache
- `DELETE /database/stats/reset` - Reset database stats

**Features:**
- Query execution time tracking
- Slow query detection
- Cache hit/miss tracking
- Optimization recommendations
- Connection pool monitoring

## Redis Keys Used

### Metrics
- `metrics:total` - Total requests
- `metrics:successful` - Successful requests
- `metrics:failed` - Failed requests
- `metrics:responseTime` - Average response time
- `metrics:responseTimeCount` - Response time sample count
- `metrics:cacheHits` - Cache hits
- `metrics:cacheMisses` - Cache misses
- `metrics:endpoints:*` - Requests by endpoint

### Analytics
- `analytics:totalRequests` - Total API requests
- `analytics:avgResponseTime` - Average response time
- `analytics:responseTimeCount` - Response time samples
- `analytics:cacheHits` - Cache hits
- `analytics:cacheMisses` - Cache misses
- `analytics:daily:*` - Daily request counts
- `analytics:users:*` - Unique users per day
- `analytics:endpoints:*` - Requests by endpoint

### Error Tracking
- `errors:total` - Total errors
- `errors:types:*` - Errors by type
- `errors:endpoints:*` - Errors by endpoint
- `errors:lastError` - Timestamp of last error
- `errors:logs` - Error log list

### Database
- `db:queries:total` - Total queries
- `db:cache:hits` - Cache hits
- `db:cache:misses` - Cache misses
- `slow:query:*` - Slow query counts
- `slow:query:count` - Total slow queries
- `slow:query:last` - Last slow query timestamp
- `query:perf:*` - Query performance data

## Usage Examples

### Track a Request

```typescript
await analyticsService.trackRequest('/species/search', 'user123', 150);
```

### Get Analytics

```typescript
const analytics = await analyticsService.getAnalytics();
```

### Log an Error

```typescript
await errorTrackingService.logErrorMethod('Service unavailable', stack, { userId: 'user123' });
```

### Get Database Stats

```typescript
const dbStats = await optimizationService.getDatabaseStats();
```

## Integration

The monitoring modules are automatically imported in `AppModule`. To use the services:

```typescript
import { MetricsService } from './monitoring/metrics.service';
import { ApiAnalyticsService } from './analytics/api-analytics.service';
import { ErrorTrackingService } from './monitoring/error-tracking.service';
import { DatabaseOptimizationService } from './database/database-optimization.service';

@Injectable()
export class MyService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly analyticsService: ApiAnalyticsService,
    private readonly errorTrackingService: ErrorTrackingService,
    private readonly optimizationService: DatabaseOptimizationService,
  ) {}

  async doSomething() {
    const start = Date.now();
    try {
      // ... your code
      await this.metricsService.incrementSuccessfulRequest();
    } catch (error) {
      await this.errorTrackingService.logErrorMethod(error.message, error.stack);
      await this.metricsService.incrementFailedRequest();
    } finally {
      await this.metricsService.recordResponseTime(Date.now() - start);
    }
  }
}
```

## Configuration

Ensure Redis is configured in your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Health Status

The system health status is determined by:
- Error rate (threshold: 10%)
- Cache hit rate (threshold: 50%)
- Redis connection status

Health status levels:
- **Healthy** - Error rate < 5%, cache hit rate > 50%, Redis connected
- **Degraded** - Error rate < 10% or cache hit rate < 50%
- **Unhealthy** - Error rate > 10% or Redis disconnected

## Best Practices

1. **Regular Monitoring**: Check health status and metrics regularly
2. **Error Analysis**: Review error logs to identify and fix issues
3. **Performance Tuning**: Use database optimization recommendations
4. **Cache Optimization**: Monitor cache hit rates and adjust cache strategy
5. **Alerting**: Set up alerts for unhealthy status
6. **Data Retention**: Periodically clear old data to manage Redis memory