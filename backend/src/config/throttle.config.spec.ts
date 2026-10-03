/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks axios/supertest typés any */
import 'reflect-metadata';
import { AdvancedSearchController } from '../species/advanced-search.controller';
import { ApiGatewayController } from '../gateway/api-gateway.controller';
import { FoodController } from '../food/food.controller';
import { OpenDataController } from '../external/open-data.controller';
import { PubMedController } from '../health-content/health-content.controller';
import { SpeciesPlusController } from '../legislation/legislation.controller';
import { OperatorGuard } from '../common/guards/operator.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  EXTERNAL_API_THROTTLE_LIMIT,
  GLOBAL_THROTTLE,
} from './throttle.config';

describe('throttle.config', () => {
  it('limites relevées en test, strictes sinon (120 global / 20 API externes)', () => {
    // jest => NODE_ENV=test : limites très hautes pour les e2e
    expect(GLOBAL_THROTTLE.limit).toBeGreaterThan(120);
    expect(EXTERNAL_API_THROTTLE_LIMIT).toBeGreaterThan(20);
    expect(GLOBAL_THROTTLE.ttl).toBe(60_000);
  });

  it('les valeurs de production sont 120 et 20 par minute', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await jest.isolateModulesAsync(async () => {
        const prod = await import('./throttle.config');
        expect(prod.GLOBAL_THROTTLE).toEqual({ ttl: 60_000, limit: 120 });
        expect(prod.EXTERNAL_API_THROTTLE).toEqual({
          default: { ttl: 60_000, limit: 20 },
        });
      });
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it.each([
    ['ApiGatewayController', ApiGatewayController],
    ['FoodController', FoodController],
    ['SpeciesPlusController', SpeciesPlusController],
    ['PubMedController', PubMedController],
    ['OpenDataController', OpenDataController],
    ['AdvancedSearchController', AdvancedSearchController],
  ])('%s porte un @Throttle strict', (_name, controller) => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', controller)).toBe(
      EXTERNAL_API_THROTTLE_LIMIT,
    );
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', controller)).toBe(
      60_000,
    );
  });

  it('POST /gateway/clear-cache/* exige JwtAuthGuard puis OperatorGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ApiGatewayController.prototype.clearCache,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, OperatorGuard]);
  });
});
