import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ApiAnalyticsService } from './api-analytics.service';
import { AnalyticsController } from './analytics.controller';

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
  ],
  controllers: [AnalyticsController],
  providers: [ApiAnalyticsService],
  exports: [ApiAnalyticsService],
})
export class AnalyticsModule {}
