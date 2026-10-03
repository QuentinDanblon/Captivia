import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { MetricsService } from './metrics.service';
import { MonitoringController } from './monitoring.controller';
import { ErrorTrackingService } from './error-tracking.service';
import { ErrorTrackingController } from './error-tracking.controller';
import { ErrorTrackingModule } from './error-tracking.module';

@Module({
  imports: [
    ConfigModule,
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const host = config.get('REDIS_HOST', 'localhost');
        const port = config.get('REDIS_PORT', '6379');
        return {
          type: 'single',
          url: `redis://${host}:${port}`,
          options: { lazyConnect: true },
        };
      },
      inject: [ConfigService],
    }),
    ErrorTrackingModule,
  ],
  controllers: [MonitoringController, ErrorTrackingController],
  providers: [MetricsService, ErrorTrackingService],
  exports: [MetricsService, ErrorTrackingService],
})
export class MonitoringModule {}
