import {
  apiOrigin,
  buildCsp,
  cspDirectives,
  isAllowedRemoteImage,
  securityHeaders,
  sentryOrigin,
  HSTS,
  type CspOptions,
} from '@/lib/csp';

const API = 'https://captivia-api.onrender.com/api';
const DSN = 'https://abc123@o42.ingest.de.sentry.io/4507';

/** Directives analysées : nom → valeurs (tableau vide pour une directive sans valeur). */
function parse(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

const prod = (options: CspOptions = {}) => parse(buildCsp({ apiUrl: API, ...options }));

describe('buildCsp — production web', () => {
  it("n'autorise jamais 'unsafe-eval'", () => {
    expect(buildCsp({ apiUrl: API })).not.toContain('unsafe-eval');
    expect(buildCsp({ apiUrl: API, sentryDsn: DSN })).not.toContain('unsafe-eval');
    expect(buildCsp({ target: 'mobile', apiUrl: API })).not.toContain('unsafe-eval');
  });

  it('contient les directives clés', () => {
    const csp = prod();
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get('font-src')).toEqual(["'self'"]);
    expect(csp.get('worker-src')).toEqual(["'self'"]);
    expect(csp.get('manifest-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('upgrade-insecure-requests')).toEqual([]);
  });

  it("img-src : soi, data:, blob: et les seuls hôtes de photos d'espèces (pas de https: générique)", () => {
    const img = prod().get('img-src') ?? [];
    expect(img.slice(0, 3)).toEqual(["'self'", 'data:', 'blob:']);
    expect(img).toContain('https://upload.wikimedia.org');
    expect(img).not.toContain('https:');
    expect(img.every((source) => !source.includes('*'))).toBe(true);
  });

  it("connect-src sans Sentry : soi et l'origine de l'API uniquement", () => {
    expect(prod().get('connect-src')).toEqual(["'self'", 'https://captivia-api.onrender.com']);
  });

  it("connect-src avec Sentry : ajoute l'origine d'ingestion, sans la clé du DSN", () => {
    const connect = prod({ sentryDsn: DSN }).get('connect-src');
    expect(connect).toEqual(["'self'", 'https://captivia-api.onrender.com', 'https://o42.ingest.de.sentry.io']);
    expect(buildCsp({ apiUrl: API, sentryDsn: DSN })).not.toContain('abc123');
  });

  it('ignore une API ou un DSN invalides', () => {
    expect(prod({ apiUrl: 'javascript:alert(1)', sentryDsn: 'http://k@sentry.example/1' }).get('connect-src')).toEqual(["'self'"]);
    expect(prod({ apiUrl: '' }).get('connect-src')).toEqual(["'self'"]);
  });

  it("pas d'upgrade-insecure-requests face à une API en http (smoke local)", () => {
    expect(prod({ apiUrl: 'http://127.0.0.1:4010' }).has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('buildCsp — développement', () => {
  it("ajoute 'unsafe-eval' (React) et le backend local, sans upgrade-insecure-requests", () => {
    const csp = parse(buildCsp({ dev: true }));
    expect(csp.get('script-src')).toContain("'unsafe-eval'");
    expect(csp.get('connect-src')).toContain('http://localhost:3001');
    expect(csp.has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('buildCsp — app mobile (<meta>)', () => {
  const hashes = ['sha256-AAAA', 'sha256-BBBB'];

  it("remplace 'unsafe-inline' par les hachages des scripts de la page", () => {
    const script = parse(buildCsp({ target: 'mobile', apiUrl: API, scriptHashes: hashes })).get('script-src');
    expect(script).toEqual(["'self'", 'capacitor://localhost', 'https://localhost', "'sha256-AAAA'", "'sha256-BBBB'"]);
  });

  it('autorise les origines Capacitor et omet frame-ancestors (ignorée en <meta>)', () => {
    const csp = parse(buildCsp({ target: 'mobile', apiUrl: API, sentryDsn: DSN }));
    expect(csp.get('default-src')).toEqual(["'self'", 'capacitor://localhost', 'https://localhost']);
    expect(csp.get('connect-src')).toEqual([
      "'self'",
      'capacitor://localhost',
      'https://localhost',
      'https://captivia-api.onrender.com',
      'https://o42.ingest.de.sentry.io',
    ]);
    expect(csp.has('frame-ancestors')).toBe(false);
    expect(csp.get('object-src')).toEqual(["'none'"]);
  });

  it('mêmes directives que le web, hors frame-ancestors', () => {
    const web = [...prod().keys()].filter((name) => name !== 'frame-ancestors');
    expect(cspDirectives({ target: 'mobile', apiUrl: API }).map(([name]) => name)).toEqual(web);
  });
});

describe('securityHeaders', () => {
  const byKey = (headers: ReturnType<typeof securityHeaders>) => new Map(headers.map((h) => [h.key, h.value]));

  it('production : CSP, HSTS deux ans sans preload, nosniff, referrer, permissions', () => {
    const headers = byKey(securityHeaders({ apiUrl: API }));
    expect(headers.get('Content-Security-Policy')).toBe(buildCsp({ apiUrl: API }));
    expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains');
    expect(HSTS).not.toContain('preload');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Permissions-Policy')).toContain('geolocation=()');
  });

  it('développement : pas de HSTS', () => {
    expect(byKey(securityHeaders({ dev: true })).has('Strict-Transport-Security')).toBe(false);
  });
});

describe('origines', () => {
  it('apiOrigin / sentryOrigin', () => {
    expect(apiOrigin(' https://api.example.org/v1 ')).toBe('https://api.example.org');
    expect(apiOrigin('ftp://api.example.org')).toBeNull();
    expect(sentryOrigin(DSN)).toBe('https://o42.ingest.de.sentry.io');
    expect(sentryOrigin(undefined)).toBeNull();
  });

  it('isAllowedRemoteImage : https et hôte de la liste uniquement', () => {
    expect(isAllowedRemoteImage('https://upload.wikimedia.org/wikipedia/commons/a/ab/x.jpg')).toBe(true);
    expect(isAllowedRemoteImage('http://upload.wikimedia.org/x.jpg')).toBe(false);
    expect(isAllowedRemoteImage('https://upload.wikimedia.org.evil.example/x.jpg')).toBe(false);
    expect(isAllowedRemoteImage('not a url')).toBe(false);
  });
});
