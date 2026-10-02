/**
 * @jest-environment-options {"url": "https://app.example.com/"}
 */
import { resolveApiUrl, DEFAULT_API_URL } from '../config';

describe('resolveApiUrl', () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;
  const withNodeEnv = (value: string) => {
    env.NODE_ENV = value;
  };
  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it('utilise NEXT_PUBLIC_API_URL même sur un hôte non local (production)', () => {
    withNodeEnv('production');
    expect(resolveApiUrl({ envUrl: 'https://api.captivia.app', hostname: 'www.captivia.app' })).toBe(
      'https://api.captivia.app',
    );
  });

  it('utilise NEXT_PUBLIC_API_URL sur un hôte LAN, y compris en développement', () => {
    withNodeEnv('development');
    expect(resolveApiUrl({ envUrl: 'https://api.example.com', hostname: '192.168.1.20' })).toBe(
      'https://api.example.com',
    );
  });

  it('supprime les slashs finaux', () => {
    withNodeEnv('production');
    expect(resolveApiUrl({ envUrl: ' https://api.example.com/// ' })).toBe('https://api.example.com');
  });

  it('ne déduit JAMAIS http://<host>:3001 hors développement quand la variable est absente', () => {
    withNodeEnv('production');
    expect(resolveApiUrl({ envUrl: undefined, hostname: 'www.captivia.app' })).toBe(DEFAULT_API_URL);
    withNodeEnv('test');
    expect(resolveApiUrl({ envUrl: '', hostname: '192.168.1.20' })).toBe(DEFAULT_API_URL);
  });

  it('en développement sans variable, utilise le même hôte LAN sur le port 3001', () => {
    withNodeEnv('development');
    expect(resolveApiUrl({ envUrl: undefined, hostname: '192.168.1.20' })).toBe('http://192.168.1.20:3001');
  });

  it('en développement sur localhost, retombe sur http://localhost:3001', () => {
    withNodeEnv('development');
    expect(resolveApiUrl({ envUrl: undefined, hostname: 'localhost' })).toBe('http://localhost:3001');
  });

  it('ignore une valeur invalide (protocole absent / URL malformée)', () => {
    withNodeEnv('production');
    expect(resolveApiUrl({ envUrl: 'api.example.com' })).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl({ envUrl: 'http://' })).toBe(DEFAULT_API_URL);
  });
});

describe('API_URL (module)', () => {
  const original = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = original;
    jest.resetModules();
  });

  it("reflète NEXT_PUBLIC_API_URL quand l'hôte de la page n'est pas local", () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    expect(window.location.hostname).toBe('app.example.com');
    let apiUrl = '';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      apiUrl = require('../config').API_URL;
    });
    expect(apiUrl).toBe('https://api.example.com');
  });

  it("ne retombe pas sur http://<host>:3001 quand l'hôte n'est pas local et que la variable est absente (hors dev)", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(window.location.hostname).toBe('app.example.com');
    let apiUrl = '';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      apiUrl = require('../config').API_URL;
    });
    expect(apiUrl).toBe('http://localhost:3001');
  });
});
