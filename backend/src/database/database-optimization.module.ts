import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { DatabaseOptimizationService } from './database-optimization.service';
import { DatabaseOptimizationController } from './database-optimization.controller';

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
  controllers: [DatabaseOptimizationController],
  providers: [DatabaseOptimizationService],
  exports: [DatabaseOptimizationService],
})
export class DatabaseOptimizationModule {}
