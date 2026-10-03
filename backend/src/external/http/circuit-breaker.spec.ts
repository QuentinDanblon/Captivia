import { CircuitBreaker } from './circuit-breaker';
import { computeBackoffDelay, parseRetryAfterMs } from './retry';

describe('CircuitBreaker', () => {
  function build(failureThreshold = 3, resetTimeoutMs = 1000) {
    let now = 0;
    const states: string[] = [];
    const breaker = new CircuitBreaker({
      failureThreshold,
      resetTimeoutMs,
      now: () => now,
      onStateChange: (s) => states.push(s),
    });
    return { breaker, states, advance: (ms: number) => (now += ms) };
  }

  it('reste fermé sous le seuil et autorise les appels', () => {
    const { breaker } = build();
    breaker.onFailure();
    breaker.onFailure();
    expect(breaker.currentState).toBe('closed');
    expect(breaker.canRequest()).toBe(true);
  });

  it('s’ouvre au seuil et refuse les appels', () => {
    const { breaker, states } = build();
    for (let i = 0; i < 3; i++) breaker.onFailure();
    expect(breaker.currentState).toBe('open');
    expect(breaker.canRequest()).toBe(false);
    expect(states).toEqual(['open']);
  });

  it('un succès remet les échecs consécutifs à zéro', () => {
    const { breaker } = build();
    breaker.onFailure();
    breaker.onFailure();
    breaker.onSuccess();
    breaker.onFailure();
    breaker.onFailure();
    expect(breaker.currentState).toBe('closed');
    expect(breaker.failures).toBe(2);
  });

  it('autorise UNE seule sonde en semi-ouvert', () => {
    const { breaker, advance } = build();
    for (let i = 0; i < 3; i++) breaker.onFailure();
    advance(1000);
    expect(breaker.currentState).toBe('half-open');
    expect(breaker.canRequest()).toBe(true); // la sonde
    expect(breaker.canRequest()).toBe(false); // pas de seconde requête en parallèle
  });

  it('sonde réussie → fermé ; sonde échouée → ouvert pour un nouveau délai', () => {
    const a = build();
    for (let i = 0; i < 3; i++) a.breaker.onFailure();
    a.advance(1000);
    a.breaker.canRequest();
    a.breaker.onSuccess();
    expect(a.breaker.currentState).toBe('closed');
    expect(a.states).toEqual(['open', 'half-open', 'closed']);

    const b = build();
    for (let i = 0; i < 3; i++) b.breaker.onFailure();
    b.advance(1000);
    b.breaker.canRequest();
    b.breaker.onFailure();
    expect(b.breaker.currentState).toBe('open');
    b.advance(999);
    expect(b.breaker.canRequest()).toBe(false);
    b.advance(1);
    expect(b.breaker.canRequest()).toBe(true);
  });
});

describe('computeBackoffDelay', () => {
  it('croît exponentiellement, plafonné, avec jitter dans [cap/2, cap]', () => {
    expect(computeBackoffDelay(1, 250, 1500, () => 0)).toBe(125);
    expect(computeBackoffDelay(1, 250, 1500, () => 1)).toBe(250);
    expect(computeBackoffDelay(2, 250, 1500, () => 1)).toBe(500);
    expect(computeBackoffDelay(3, 250, 1500, () => 1)).toBe(1000);
    expect(computeBackoffDelay(4, 250, 1500, () => 1)).toBe(1500);
    expect(computeBackoffDelay(10, 250, 1500, () => 1)).toBe(1500);
  });

  it('deux tirages différents donnent deux délais différents (désynchronise les clients)', () => {
    const a = computeBackoffDelay(3, 250, 1500, () => 0.1);
    const b = computeBackoffDelay(3, 250, 1500, () => 0.9);
    expect(a).not.toBe(b);
    for (const d of [a, b]) {
      expect(d).toBeGreaterThanOrEqual(500);
      expect(d).toBeLessThanOrEqual(1000);
    }
  });

  it('utilise Math.random par défaut', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(computeBackoffDelay(1, 200, 1000)).toBe(100);
    jest.restoreAllMocks();
  });
});

describe('parseRetryAfterMs', () => {
  it('lit des secondes, une date HTTP, ignore le reste', () => {
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs(2)).toBe(2000);
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:05 GMT', now)).toBe(5000);
    expect(parseRetryAfterMs('Thu, 01 Jan 2025 00:00:05 GMT', now)).toBe(0);
    expect(parseRetryAfterMs('n/a')).toBeNull();
    expect(parseRetryAfterMs(undefined)).toBeNull();
    expect(parseRetryAfterMs('')).toBeNull();
  });
});
