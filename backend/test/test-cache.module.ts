import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from '../src/cache/cache.service';

/**
 * Test cache module that provides in-memory CacheService (sync) for E2E tests.
 * Avoids Redis/Memcached and ensures CacheService is resolvable.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    ConfigService,
    {
      provide: 'CACHE_SERVICE',
      useFactory: (config: ConfigService) => new CacheService(config),
      inject: [ConfigService],
    },
    { provide: CacheService, useExisting: 'CACHE_SERVICE' },
  ],
  exports: ['CACHE_SERVICE', CacheService],
})
export class TestCacheModule {}
