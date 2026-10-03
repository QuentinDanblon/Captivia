import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ErrorTrackingService } from './error-tracking.service';
import { ErrorTrackingController } from './error-tracking.controller';

@Module({
  imports: [
    ConfigModule,
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<string>('REDIS_PORT', '6379');
        return {
          type: 'single',
          url: `redis://${host}:${port}`,
          options: { lazyConnect: true },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ErrorTrackingController],
  providers: [ErrorTrackingService],
  exports: [ErrorTrackingService],
})
export class ErrorTrackingModule {}
