import { buildLoggerParams, redactTokenInUrl } from './logger.config';

describe('redactTokenInUrl', () => {
  it("masque le jeton du flux iCalendar dans l'URL", () => {
    expect(redactTokenInUrl('/users/me/agenda.ics?token=abc_DEF-123')).toBe(
      '/users/me/agenda.ics?token=[REDACTED]',
    );
    expect(redactTokenInUrl('/x?a=1&token=secret&b=2')).toBe(
      '/x?a=1&token=[REDACTED]&b=2',
    );
  });

  it('laisse intactes les URL sans jeton et les valeurs non textuelles', () => {
    expect(redactTokenInUrl('/users/me/agenda?from=2026-10-01')).toBe(
      '/users/me/agenda?from=2026-10-01',
    );
    expect(redactTokenInUrl(undefined)).toBeUndefined();
  });
});

describe('serializer de requête des logs', () => {
  it('ne journalise jamais le jeton (url et query)', () => {
    const params = buildLoggerParams();
    const pinoHttp = params.pinoHttp as {
      serializers: {
        req: (r: Record<string, unknown>) => Record<string, unknown>;
      };
    };
    const out = pinoHttp.serializers.req({
      method: 'GET',
      url: '/users/me/agenda.ics?token=SECRET',
      query: { token: 'SECRET' },
    });
    expect(JSON.stringify(out)).not.toContain('SECRET');
    expect(out.method).toBe('GET');
  });
});
