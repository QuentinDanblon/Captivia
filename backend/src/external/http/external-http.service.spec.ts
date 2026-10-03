import { Logger } from '@nestjs/common';
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import {
  EXTERNAL_MAX_CONTENT_LENGTH,
  EXTERNAL_MAX_REDIRECTS,
  EXTERNAL_TIMEOUT_MS,
  EXTERNAL_USER_AGENT,
  ExternalHttpService,
  assertSafeRedirect,
  isTransientError,
} from './external-http.service';
import { ExternalUnavailableError } from './external-errors';

type Step =
  | { ok: unknown }
  | { status: number; headers?: Record<string, string> }
  | { network: string }
  /** La tentative « dure » `ms` ms (horloge simulée) puis expire. */
  | { timeoutAfter: number };

/**
 * Banc d'essai : horloge, attente et aléa simulés, transport scripté.
 * Aucun timer réel ni appel réseau : les tests sont instantanés et déterministes.
 */
function setup(steps: Step[], random = 0.5) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const configs: InternalAxiosRequestConfig[] = [];
  let index = 0;

  // Adaptateur scripté : l'exécuteur de la promesse transforme tout `throw` en rejet.
  const respond = (config: InternalAxiosRequestConfig) => {
    configs.push(config);
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;

    if ('ok' in step) {
      return {
        status: 200,
        statusText: 'OK',
        data: step.ok,
        headers: {},
        config,
        request: {},
      };
    }
    if ('status' in step) {
      throw new AxiosError(
        `Request failed with status code ${step.status}`,
        step.status >= 500
          ? AxiosError.ERR_BAD_RESPONSE
          : AxiosError.ERR_BAD_REQUEST,
        config,
        {},
        {
          status: step.status,
          statusText: '',
          data: {},
          headers: new AxiosHeaders(step.headers ?? {}),
          config,
        },
      );
    }
    if ('timeoutAfter' in step) {
      // Une requête réelle est coupée par son timeout (réduit au budget restant).
      clock += Math.min(step.timeoutAfter, config.timeout ?? step.timeoutAfter);
      throw new AxiosError(
        `timeout of ${config.timeout}ms exceeded`,
        AxiosError.ECONNABORTED,
        config,
      );
    }
    throw new AxiosError(step.network, AxiosError.ERR_NETWORK, config);
  };
  const adapter = jest.fn(
    (config: InternalAxiosRequestConfig) =>
      new Promise((resolve) => resolve(respond(config))),
  );

  const http = new ExternalHttpService({
    adapter: adapter as never,
    now: () => clock,
    sleep: (ms) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    random: () => random,
  });

  return {
    http,
    adapter,
    configs,
    sleeps,
    advance: (ms: number) => {
      clock += ms;
    },
    elapsedSince: (start: number) => clock - start,
    now: () => clock,
  };
}

describe('ExternalHttpService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('garde-fous de l’instance partagée', () => {
    it('timeout 5 s, redirections limitées, taille de réponse bornée, User-Agent explicite', async () => {
      const t = setup([{ ok: { a: 1 } }]);

      const response = await t.http.get('gbif', 'https://api.gbif.org/v1/x');

      expect(response.data).toEqual({ a: 1 });
      const config = t.configs[0];
      expect(config.timeout).toBe(EXTERNAL_TIMEOUT_MS);
      expect(EXTERNAL_TIMEOUT_MS).toBe(5000);
      expect(config.maxRedirects).toBe(EXTERNAL_MAX_REDIRECTS);
      expect(config.maxRedirects).toBeGreaterThan(0);
      expect(config.maxRedirects).toBeLessThanOrEqual(5);
      expect(config.maxContentLength).toBe(EXTERNAL_MAX_CONTENT_LENGTH);
      expect(config.headers.get('User-Agent')).toBe(EXTERNAL_USER_AGENT);
      expect(EXTERNAL_USER_AGENT).toMatch(/^Captivia\/\d/);
      expect(typeof config.beforeRedirect).toBe('function');
    });

    it('conserve les en-têtes et paramètres de l’appelant (ex. jeton Species+)', async () => {
      const t = setup([{ ok: {} }]);

      await t.http.get('speciesplus', 'https://api.speciesplus.net/x', {
        params: { name: 'Boa' },
        headers: { 'X-Authentication-Token': 'tok' },
      });

      expect(t.configs[0].params).toEqual({ name: 'Boa' });
      expect(t.configs[0].headers.get('X-Authentication-Token')).toBe('tok');
      expect(t.configs[0].headers.get('User-Agent')).toBe(EXTERNAL_USER_AGENT);
    });
  });

  describe('retry GBIF (erreur réseau, 5xx, 429 uniquement)', () => {
    it('réessaie après 503 puis réussit : 3 tentatives, backoff + jitter croissants', async () => {
      const t = setup(
        [{ status: 503 }, { status: 502 }, { ok: { key: 1 } }],
        0.5,
      );

      const response = await t.http.get(
        'gbif',
        'https://api.gbif.org/v1/species/1',
      );

      expect(response.data).toEqual({ key: 1 });
      expect(t.adapter).toHaveBeenCalledTimes(3);
      expect(t.sleeps).toHaveLength(2);
      // random = 0.5, base 250 ms : 1er réessai cap 250 → 188, 2e cap 500 → 375
      expect(t.sleeps[0]).toBe(188);
      expect(t.sleeps[1]).toBe(375);
      expect(t.sleeps[1]).toBeGreaterThan(t.sleeps[0]);
    });

    it('le jitter reste dans [cap/2, cap] selon l’aléa', async () => {
      const low = setup([{ status: 503 }, { ok: {} }], 0);
      await low.http.get('gbif', 'https://api.gbif.org/v1/x');
      const high = setup([{ status: 503 }, { ok: {} }], 0.999);
      await high.http.get('gbif', 'https://api.gbif.org/v1/x');

      expect(low.sleeps[0]).toBe(125);
      expect(high.sleeps[0]).toBeGreaterThanOrEqual(249);
      expect(high.sleeps[0]).toBeLessThanOrEqual(250);
    });

    it('réessaie sur erreur réseau (sans réponse HTTP)', async () => {
      const t = setup([
        { network: 'getaddrinfo EAI_AGAIN' },
        { ok: { ok: true } },
      ]);

      await expect(
        t.http.get('gbif', 'https://api.gbif.org/v1/x'),
      ).resolves.toMatchObject({ data: { ok: true } });
      expect(t.adapter).toHaveBeenCalledTimes(2);
    });

    it('réessaie sur 429 et respecte Retry-After quand il tient dans le budget', async () => {
      const t = setup([
        { status: 429, headers: { 'retry-after': '2' } },
        { ok: {} },
      ]);

      await t.http.get('gbif', 'https://api.gbif.org/v1/x');

      expect(t.adapter).toHaveBeenCalledTimes(2);
      expect(t.sleeps[0]).toBe(2000);
    });

    it('abandonne si Retry-After dépasse le budget total', async () => {
      const t = setup([
        { status: 429, headers: { 'retry-after': '30' } },
        { ok: {} },
      ]);

      await expect(
        t.http.get('gbif', 'https://api.gbif.org/v1/x'),
      ).rejects.toMatchObject({ response: { status: 429 } });
      expect(t.adapter).toHaveBeenCalledTimes(1);
      expect(t.sleeps).toHaveLength(0);
    });

    it('ne réessaie PAS sur 404 / 400 (réponse valide du fournisseur)', async () => {
      for (const status of [404, 400, 403]) {
        const t = setup([{ status }, { ok: {} }]);
        await expect(
          t.http.get('gbif', 'https://api.gbif.org/v1/x'),
        ).rejects.toMatchObject({ response: { status } });
        expect(t.adapter).toHaveBeenCalledTimes(1);
        expect(t.sleeps).toHaveLength(0);
      }
    });

    it('au plus 3 tentatives, puis propage la dernière erreur d’origine', async () => {
      const t = setup([{ status: 500 }]);

      await expect(
        t.http.get('gbif', 'https://api.gbif.org/v1/x'),
      ).rejects.toMatchObject({ response: { status: 500 } });
      expect(t.adapter).toHaveBeenCalledTimes(3);
    });

    it('budget total < 8 s même si chaque tentative expire (timeout réduit au budget restant)', async () => {
      const t = setup([{ timeoutAfter: 5000 }]);
      const start = t.now();

      await expect(
        t.http.get('gbif', 'https://api.gbif.org/v1/x'),
      ).rejects.toMatchObject({ code: AxiosError.ECONNABORTED });

      expect(t.elapsedSince(start)).toBeLessThan(8000);
      // 2e tentative plafonnée au budget restant, jamais 5 s pleines
      expect(t.configs.length).toBeLessThanOrEqual(3);
      for (const config of t.configs.slice(1)) {
        expect(config.timeout).toBeLessThan(5000);
      }
    });

    it('retry:false → une seule tentative (sonde de santé)', async () => {
      const t = setup([{ status: 503 }, { ok: {} }]);

      await expect(
        t.http.get('gbif', 'https://api.gbif.org/v1/x', { retry: false }),
      ).rejects.toMatchObject({ response: { status: 503 } });
      expect(t.adapter).toHaveBeenCalledTimes(1);
      expect(t.configs[0]).not.toHaveProperty('retry');
    });

    it('les autres fournisseurs ne réessaient pas (une tentative)', async () => {
      const t = setup([{ status: 503 }, { ok: {} }]);

      await expect(
        t.http.get('openpetfoodfacts', 'https://world.openpetfoodfacts.org/x'),
      ).rejects.toMatchObject({ response: { status: 503 } });
      expect(t.adapter).toHaveBeenCalledTimes(1);
    });
  });

  describe('disjoncteur par fournisseur', () => {
    it('s’ouvre après 5 échecs consécutifs : l’appel suivant échoue SANS requête réseau', async () => {
      const t = setup([{ status: 503 }]);
      const url = 'https://world.openpetfoodfacts.org/x';

      for (let i = 0; i < 5; i++) {
        await expect(t.http.get('openpetfoodfacts', url)).rejects.toMatchObject(
          {
            response: { status: 503 },
          },
        );
      }
      expect(t.http.isCircuitOpen('openpetfoodfacts')).toBe(true);
      expect(t.adapter).toHaveBeenCalledTimes(5);

      await expect(t.http.get('openpetfoodfacts', url)).rejects.toBeInstanceOf(
        ExternalUnavailableError,
      );
      expect(t.adapter).toHaveBeenCalledTimes(5);
    });

    it('est isolé par fournisseur (GBIF ouvert, Wikipedia intact)', async () => {
      const t = setup([{ status: 503 }]);
      for (let i = 0; i < 5; i++) {
        await t.http
          .get('gbif', 'https://api.gbif.org/v1/x', { retry: false })
          .catch(() => undefined);
      }
      expect(t.http.isCircuitOpen('gbif')).toBe(true);
      expect(t.http.isCircuitOpen('wikipedia')).toBe(false);
      expect(t.http.circuitStates()).toMatchObject({ gbif: 'open' });
    });

    it('un 404 (réponse valide) ne compte pas comme un échec', async () => {
      const t = setup([{ status: 404 }]);
      for (let i = 0; i < 12; i++) {
        await t.http
          .get('gbif', 'https://api.gbif.org/v1/x')
          .catch(() => undefined);
      }
      expect(t.http.isCircuitOpen('gbif')).toBe(false);
    });

    it('un succès remet le compteur d’échecs à zéro', async () => {
      const t = setup([
        { status: 503 },
        { status: 503 },
        { status: 503 },
        { status: 503 },
        { ok: {} },
        { status: 503 },
        { status: 503 },
        { status: 503 },
        { status: 503 },
      ]);
      const url = 'https://world.openpetfoodfacts.org/x';
      for (let i = 0; i < 9; i++) {
        await t.http.get('openpetfoodfacts', url).catch(() => undefined);
      }
      expect(t.http.isCircuitOpen('openpetfoodfacts')).toBe(false);
    });

    it('semi-ouvert après 30 s : une sonde ; succès → refermé', async () => {
      const t = setup([
        ...Array.from({ length: 5 }, () => ({ status: 503 }) as Step),
        { ok: { back: true } },
      ]);
      const url = 'https://world.openpetfoodfacts.org/x';
      for (let i = 0; i < 5; i++) {
        await t.http.get('openpetfoodfacts', url).catch(() => undefined);
      }
      expect(t.http.circuitState('openpetfoodfacts')).toBe('open');

      t.advance(29_000);
      await expect(t.http.get('openpetfoodfacts', url)).rejects.toBeInstanceOf(
        ExternalUnavailableError,
      );

      t.advance(1_500);
      expect(t.http.circuitState('openpetfoodfacts')).toBe('half-open');
      await expect(t.http.get('openpetfoodfacts', url)).resolves.toMatchObject({
        data: { back: true },
      });
      expect(t.http.circuitState('openpetfoodfacts')).toBe('closed');
    });

    it('sonde en échec → circuit rouvert pour un nouveau délai', async () => {
      const t = setup([{ status: 503 }]);
      const url = 'https://world.openpetfoodfacts.org/x';
      for (let i = 0; i < 5; i++) {
        await t.http.get('openpetfoodfacts', url).catch(() => undefined);
      }
      t.advance(31_000);
      await expect(t.http.get('openpetfoodfacts', url)).rejects.toMatchObject({
        response: { status: 503 },
      });
      expect(t.http.circuitState('openpetfoodfacts')).toBe('open');
      await expect(t.http.get('openpetfoodfacts', url)).rejects.toBeInstanceOf(
        ExternalUnavailableError,
      );
    });
  });

  describe('isTransientError', () => {
    const cfg = {} as InternalAxiosRequestConfig;
    const withStatus = (status: number) =>
      new AxiosError(
        'x',
        AxiosError.ERR_BAD_RESPONSE,
        cfg,
        {},
        {
          status,
          statusText: '',
          data: {},
          headers: {},
          config: cfg,
        },
      );

    it.each([500, 502, 503, 504, 429])('%i est transitoire', (status) => {
      expect(isTransientError(withStatus(status))).toBe(true);
    });
    it.each([400, 401, 403, 404, 410, 422])('%i ne l’est pas', (status) => {
      expect(isTransientError(withStatus(status))).toBe(false);
    });
    it('réseau / timeout : oui ; dépassement de taille ou de redirections : non', () => {
      expect(
        isTransientError(new AxiosError('x', AxiosError.ERR_NETWORK)),
      ).toBe(true);
      expect(
        isTransientError(new AxiosError('x', AxiosError.ECONNABORTED)),
      ).toBe(true);
      expect(isTransientError(new AxiosError('x', 'ECONNRESET'))).toBe(true);
      expect(
        isTransientError(new AxiosError('x', AxiosError.ERR_BAD_RESPONSE)),
      ).toBe(false);
      expect(
        isTransientError(new AxiosError('x', 'ERR_FR_TOO_MANY_REDIRECTS')),
      ).toBe(false);
      expect(isTransientError(new Error('bug applicatif'))).toBe(false);
    });
  });

  describe('assertSafeRedirect', () => {
    it('accepte une redirection https vers un hôte public', () => {
      expect(() =>
        assertSafeRedirect({
          protocol: 'https:',
          hostname: 'en.wikipedia.org',
          headers: {},
        }),
      ).not.toThrow();
    });

    it.each([
      [{ protocol: 'http:', hostname: 'example.org' }],
      [{ protocol: 'https:', hostname: 'localhost' }],
      [{ protocol: 'https:', hostname: '127.0.0.1' }],
      [{ protocol: 'https:', hostname: '169.254.169.254' }],
      [{ protocol: 'https:', hostname: '[::1]' }],
      [{ protocol: 'https:', hostname: 'db.internal' }],
      [{ protocol: 'file:', hostname: '' }],
    ])('bloque %j', (options) => {
      expect(() => assertSafeRedirect({ ...options, headers: {} })).toThrow(
        'Redirect blocked',
      );
    });

    it('ne retransmet jamais les secrets du fournisseur', () => {
      const options = {
        protocol: 'https:',
        hostname: 'other.example.org',
        headers: {
          'X-Authentication-Token': 'secret',
          Authorization: 'Bearer x',
          Accept: 'a',
        },
      };
      assertSafeRedirect(options);
      expect(options.headers).toEqual({ Accept: 'a' });
    });
  });
});
