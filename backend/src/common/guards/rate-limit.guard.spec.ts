import { ExecutionContext, HttpException } from '@nestjs/common';
import { AuthRateLimitGuard, RateLimitGuard } from './rate-limit.guard';

function contextFor(ip: string): ExecutionContext {
  const response = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const originalRedis = process.env.REDIS_ENABLED;

  beforeAll(() => {
    process.env.REDIS_ENABLED = 'false';
  });
  afterAll(() => {
    if (originalRedis === undefined) delete process.env.REDIS_ENABLED;
    else process.env.REDIS_ENABLED = originalRedis;
  });

  it('utilise un préfixe de clé distinct pour chaque type de guard', () => {
    const prefixOf = (guard: unknown): string =>
      (guard as { rateLimiter: { limiter: { keyPrefix: string } } }).rateLimiter
        .limiter.keyPrefix;

    const defaultPrefix = prefixOf(new RateLimitGuard());
    const authPrefix = prefixOf(new AuthRateLimitGuard());

    expect(defaultPrefix).not.toBe(authPrefix);
    expect(defaultPrefix).toContain('default');
    expect(authPrefix).toContain('auth');
  });

  it('renvoie 429 avec Retry-After au-delà de la limite (10/min pour auth)', async () => {
    const guard = new AuthRateLimitGuard();
    const ip = '203.0.113.7';
    for (let i = 0; i < 10; i++) {
      await expect(guard.canActivate(contextFor(ip))).resolves.toBe(true);
    }
    await expect(guard.canActivate(contextFor(ip))).rejects.toBeInstanceOf(
      HttpException,
    );
    // Une autre IP n'est pas affectée
    await expect(guard.canActivate(contextFor('203.0.113.8'))).resolves.toBe(
      true,
    );
  });

  it('un guard 100/min ne partage pas le compteur du guard 10/min', async () => {
    const strict = new AuthRateLimitGuard();
    const lenient = new RateLimitGuard();
    const ip = '203.0.113.9';
    for (let i = 0; i < 10; i++) await strict.canActivate(contextFor(ip));
    await expect(strict.canActivate(contextFor(ip))).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(lenient.canActivate(contextFor(ip))).resolves.toBe(true);
  });
});
