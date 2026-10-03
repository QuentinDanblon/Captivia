import Redis from 'ioredis';
import {
  ANALYTICS_DAILY_TTL_SECONDS,
  ApiAnalyticsService,
  analyticsUserKey,
} from './api-analytics.service';

/** Redis simulé : enregistre les commandes du pipeline. */
function buildRedis() {
  const calls: [string, ...unknown[]][] = [];
  const pipeline = new Proxy(
    { exec: jest.fn(() => Promise.resolve([])) } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        return (...args: unknown[]) => {
          calls.push([prop, ...args]);
          return pipeline;
        };
      },
    },
  );
  const cb = (...args: unknown[]) => {
    const done = args[args.length - 1];
    if (typeof done === 'function')
      (done as (e: null, v: null) => void)(null, null);
  };
  const redis = {
    pipeline: () => pipeline,
    get: cb,
    set: cb,
    incr: cb,
    incrby: cb,
    del: cb,
    lpush: cb,
    lrange: cb,
  } as unknown as Redis;
  return { redis, calls };
}

describe('ApiAnalyticsService.trackRequest (W2-08, LEG-06)', () => {
  it('stores only a pseudonym of the JWT user, with a 90-day expiry', async () => {
    const { redis, calls } = buildRedis();
    await new ApiAnalyticsService(redis).trackRequest(
      '/species',
      'user-123',
      40,
    );

    const sadd = calls.filter((c) => c[0] === 'sadd');
    expect(sadd).toHaveLength(1);
    expect(sadd[0][2]).toBe(analyticsUserKey('user-123'));
    expect(JSON.stringify(calls)).not.toContain('user-123');
    expect(
      calls.filter(
        (c) => c[0] === 'expire' && c[2] === ANALYTICS_DAILY_TTL_SECONDS,
      ),
    ).toHaveLength(2);
  });

  it('counts an anonymous call without adding a visitor', async () => {
    const { redis, calls } = buildRedis();
    await new ApiAnalyticsService(redis).trackRequest('/species', null, 40);
    expect(calls.some((c) => c[0] === 'sadd')).toBe(false);
    expect(calls.some((c) => c[0] === 'incr')).toBe(true);
  });

  it('derives a stable, non-reversible key', () => {
    expect(analyticsUserKey('a')).toBe(analyticsUserKey('a'));
    expect(analyticsUserKey('a')).not.toBe(analyticsUserKey('b'));
    expect(analyticsUserKey('a')).toMatch(/^[a-f0-9]{32}$/);
  });
});
