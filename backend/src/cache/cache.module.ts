import { Module, DynamicModule, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { RedisCacheService } from './redis-cache.service';
import { MemcachedCacheService } from './memcached-cache.service';

@Global()
@Module({})
export class CacheModule {
  static registerAsync(): DynamicModule {
    return {
      module: CacheModule,
      imports: [ConfigModule],
      providers: [
        ConfigService,
        {
          provide: 'CACHE_SERVICE',
          useFactory: (configService: ConfigService) => {
            const cacheType = configService.get('CACHE_TYPE') || 'memory';

            if (cacheType === 'redis') {
              return new RedisCacheService();
            } else if (cacheType === 'memcached') {
              return new MemcachedCacheService();
            }
            // Default to memory cache
            return new CacheService(configService);
          },
          inject: [ConfigService],
        },
        { provide: CacheService, useExisting: 'CACHE_SERVICE' },
      ],
      exports: ['CACHE_SERVICE', CacheService],
    };
  }

  static register(): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        ConfigService,
        {
          provide: 'CACHE_SERVICE',
          useFactory: (configService: ConfigService) =>
            new CacheService(configService),
        },
        { provide: CacheService, useExisting: 'CACHE_SERVICE' },
      ],
      exports: ['CACHE_SERVICE', CacheService],
    };
  }

  static registerMemcached(): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        ConfigService,
        {
          provide: 'CACHE_SERVICE',
          useFactory: () => new MemcachedCacheService(),
        },
        { provide: CacheService, useExisting: 'CACHE_SERVICE' },
      ],
      exports: ['CACHE_SERVICE', CacheService],
    };
  }
}
