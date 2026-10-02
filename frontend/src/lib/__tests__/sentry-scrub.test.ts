import { FILTERED, scrubSentryEvent, scrubTokenInString } from '../sentry-scrub';

describe('sentry-scrub', () => {
  it('masque le paramètre token dans une URL, en conservant le reste', () => {
    expect(scrubTokenInString('https://app.captivia.com/reset-password?token=abc123&x=1')).toBe(
      `https://app.captivia.com/reset-password?token=${FILTERED}&x=1`,
    );
    expect(scrubTokenInString('/fr/reset-password?lang=fr&token=abc#top')).toBe(
      `/fr/reset-password?lang=fr&token=${FILTERED}#top`,
    );
    expect(scrubTokenInString('token=abc')).toBe(`token=${FILTERED}`);
    expect(scrubTokenInString('https://x.test/a?notatoken=1')).toBe('https://x.test/a?notatoken=1');
  });

  it("masque le token dans request, transaction, breadcrumbs et spans d'un événement", () => {
    const url = 'https://app.captivia.com/reset-password?token=SECRET';
    const event = {
      transaction: '/reset-password?token=SECRET',
      request: {
        url,
        query_string: 'token=SECRET',
        headers: { Referer: url },
      },
      breadcrumbs: [
        { category: 'navigation', data: { from: url, to: '/login' } },
        { category: 'fetch', data: { url: 'https://api.example.com/auth/x?token=SECRET' } },
      ],
      spans: [{ description: `GET ${url}`, data: { query: { token: 'SECRET' } } }],
    };

    const out = JSON.stringify(scrubSentryEvent(event));
    expect(out).not.toContain('SECRET');
    expect(out).toContain(FILTERED);
  });

  it('ne plante pas sur null / valeurs non objets', () => {
    expect(scrubSentryEvent(null)).toBeNull();
    expect(scrubSentryEvent({ a: undefined, b: 3 })).toEqual({ a: undefined, b: 3 });
  });
});
