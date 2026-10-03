import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import axios, {
  AxiosAdapter,
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { describeHttpError } from '../http-safety';
import {
  CircuitBreaker,
  CircuitBreakerOptions,
  CircuitState,
} from './circuit-breaker';
import { ExternalUnavailableError } from './external-errors';
import { getExternalHttpAdapterOverride } from './http-adapter-override';
import { computeBackoffDelay, parseRetryAfterMs } from './retry';

/** Fournisseurs tiers appelés par le backend : un disjoncteur chacun. */
export type ExternalProvider =
  | 'gbif'
  | 'wikipedia'
  | 'wikidata'
  | 'wikidata-sparql'
  | 'openpetfoodfacts'
  | 'pubmed'
  | 'speciesplus'
  | 'inaturalist'
  | 'eol';

/** Garde-fous communs à tous les appels sortants. */
export const EXTERNAL_TIMEOUT_MS = 5000;
export const EXTERNAL_MAX_REDIRECTS = 3;
export const EXTERNAL_MAX_CONTENT_LENGTH = 5 * 1024 * 1024;
export const EXTERNAL_USER_AGENT = 'Captivia/1.0 (+https://captivia.com)';
/** En-têtes jamais retransmis lors d'une redirection (secrets de fournisseur). */
const SENSITIVE_HEADERS = [
  'x-authentication-token',
  'authorization',
  'x-api-key',
];
/** Durée minimale utile d'une nouvelle tentative : en deçà, on abandonne. */
const MIN_ATTEMPT_MS = 500;

export interface RetryPolicy {
  /** Nombre total de tentatives (1 = aucun réessai). */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Budget TOTAL (toutes tentatives et attentes comprises), en ms. */
  budgetMs: number;
}

export interface ProviderPolicy {
  retry?: RetryPolicy;
  breaker: Pick<CircuitBreakerOptions, 'failureThreshold' | 'resetTimeoutMs'>;
}

const DEFAULT_BREAKER = { failureThreshold: 5, resetTimeoutMs: 30_000 };

/**
 * GBIF : 3 tentatives max (erreur réseau, 5xx ou 429 uniquement), budget total 7,5 s
 * (< 8 s), quelle que soit la lenteur de chaque tentative. Autres fournisseurs : une
 * seule tentative (le disjoncteur protège la suite).
 */
export const DEFAULT_PROVIDER_POLICIES: Partial<
  Record<ExternalProvider, ProviderPolicy>
> = {
  gbif: {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 250,
      maxDelayMs: 1500,
      budgetMs: 7500,
    },
    breaker: DEFAULT_BREAKER,
  },
};

export interface ExternalHttpOptions {
  /** Transport HTTP de remplacement (tests). */
  adapter?: AxiosAdapter;
  /** Horloge, attente et aléa injectables (tests déterministes). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  policies?: Partial<Record<ExternalProvider, ProviderPolicy>>;
}

export const EXTERNAL_HTTP_OPTIONS = 'EXTERNAL_HTTP_OPTIONS';

export type ExternalRequestConfig = AxiosRequestConfig & {
  /** `false` : une seule tentative même pour un fournisseur avec retry (ex. sonde de santé). */
  retry?: boolean;
};

/**
 * Erreur « transitoire » : réseau, timeout, 5xx ou 429 — la seule catégorie réessayée
 * et comptée par le disjoncteur. Un 4xx (404, 400…) est une réponse valide du
 * fournisseur ; un dépassement de taille ou de redirections n'est jamais réessayé.
 */
export function isTransientError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (typeof status === 'number') return status >= 500 || status === 429;
  const code = error.code;
  return !(
    code === AxiosError.ERR_BAD_RESPONSE ||
    code === AxiosError.ERR_BAD_REQUEST ||
    code === AxiosError.ERR_CANCELED ||
    code === 'ERR_FR_TOO_MANY_REDIRECTS' ||
    code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' ||
    code === 'ERR_BLOCKED_REDIRECT'
  );
}

/**
 * Contrôle d'une redirection (appelé par axios/follow-redirects avant de la suivre) :
 * https uniquement, jamais vers localhost/une IP littérale (SSRF), et aucun secret
 * de fournisseur retransmis.
 */
export function assertSafeRedirect(options: Record<string, any>): void {
  const protocol = String(options.protocol ?? '');
  const hostname = String(options.hostname ?? options.host ?? '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  const isIpLiteral =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  if (
    protocol !== 'https:' ||
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isIpLiteral
  ) {
    const error = new Error('Redirect blocked by external HTTP policy');
    (error as Error & { code?: string }).code = 'ERR_BLOCKED_REDIRECT';
    throw error;
  }
  if (options.headers && typeof options.headers === 'object') {
    for (const name of Object.keys(options.headers)) {
      if (SENSITIVE_HEADERS.includes(name.toLowerCase())) {
        delete options.headers[name];
      }
    }
  }
}

/**
 * Client HTTP SORTANT UNIQUE et partagé par toutes les intégrations (GBIF, Wikipedia,
 * Wikidata, Open Pet Food Facts, PubMed, Species+, iNaturalist, EOL) :
 * - timeout 5 s par tentative, 3 redirections max (https, hôtes publics), réponse ≤ 5 Mo,
 *   User-Agent explicite ;
 * - retry avec backoff + jitter, borné par un budget total (GBIF) ;
 * - disjoncteur par fournisseur : ouvert, l'appel échoue immédiatement
 *   (`ExternalUnavailableError`) sans toucher le réseau.
 *
 * Les erreurs HTTP sont propagées telles quelles (AxiosError) : c'est à l'appelant de
 * choisir son repli (profil local, cache périmé) et de ne PAS mettre en cache un échec.
 */
@Injectable()
export class ExternalHttpService {
  private readonly logger = new Logger(ExternalHttpService.name);
  private readonly client: AxiosInstance;
  private readonly breakers = new Map<ExternalProvider, CircuitBreaker>();
  private readonly policies: Partial<Record<ExternalProvider, ProviderPolicy>>;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(
    @Optional()
    @Inject(EXTERNAL_HTTP_OPTIONS)
    options: ExternalHttpOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.policies = options.policies ?? DEFAULT_PROVIDER_POLICIES;

    this.client = axios.create({
      timeout: EXTERNAL_TIMEOUT_MS,
      maxRedirects: EXTERNAL_MAX_REDIRECTS,
      maxContentLength: EXTERNAL_MAX_CONTENT_LENGTH,
      maxBodyLength: EXTERNAL_MAX_CONTENT_LENGTH,
      headers: { 'User-Agent': EXTERNAL_USER_AGENT },
      beforeRedirect: assertSafeRedirect,
      adapter: options.adapter ?? getExternalHttpAdapterOverride(),
    });
  }

  /** GET résilient vers un fournisseur externe. */
  async get<T = unknown>(
    provider: ExternalProvider,
    url: string,
    config: ExternalRequestConfig = {},
  ): Promise<AxiosResponse<T>> {
    const { retry: retryEnabled = true, ...axiosConfig } = config;
    const policy = this.policies[provider];
    const breaker = this.breakerFor(provider);
    const timeout = axiosConfig.timeout ?? EXTERNAL_TIMEOUT_MS;
    const maxAttempts = retryEnabled ? (policy?.retry?.maxAttempts ?? 1) : 1;
    const budgetMs =
      policy?.retry && retryEnabled ? policy.retry.budgetMs : timeout;
    const started = this.now();

    for (let attempt = 1; ; attempt++) {
      if (!breaker.canRequest()) {
        throw new ExternalUnavailableError(provider, 'circuit_open');
      }
      // Le budget restant est vérifié avant chaque attente : il reste ici toujours > 0.
      const remaining = Math.max(1, budgetMs - (this.now() - started));

      try {
        const response = await this.client.get<T>(url, {
          ...axiosConfig,
          timeout: Math.min(timeout, remaining),
        });
        breaker.onSuccess();
        return response;
      } catch (error) {
        const transient = isTransientError(error);
        if (transient) {
          breaker.onFailure();
        } else {
          // Le fournisseur a répondu (404, 400…) : il est joignable.
          breaker.onSuccess();
        }
        if (!transient || attempt >= maxAttempts || !policy?.retry) throw error;

        const delay = this.retryDelay(error, attempt, policy.retry);
        const elapsed = this.now() - started;
        if (elapsed + delay + MIN_ATTEMPT_MS > budgetMs) throw error;

        this.logger.warn(
          `${provider}: tentative ${attempt}/${maxAttempts} échouée (${describeHttpError(error)}), nouvel essai dans ${delay} ms`,
        );
        await this.sleep(delay);
      }
    }
  }

  /** Le disjoncteur du fournisseur est-il ouvert (appel immédiatement refusé) ? */
  isCircuitOpen(provider: ExternalProvider): boolean {
    return this.breakerFor(provider).currentState === 'open';
  }

  circuitState(provider: ExternalProvider): CircuitState {
    return this.breakerFor(provider).currentState;
  }

  /** Instantané des disjoncteurs ouverts ou semi-ouverts (diagnostic / santé). */
  circuitStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [provider, breaker] of this.breakers) {
      states[provider] = breaker.currentState;
    }
    return states;
  }

  private retryDelay(
    error: unknown,
    attempt: number,
    retry: RetryPolicy,
  ): number {
    let delay = computeBackoffDelay(
      attempt,
      retry.baseDelayMs,
      retry.maxDelayMs,
      this.random,
    );
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      const retryAfter = parseRetryAfterMs(
        error.response.headers?.['retry-after'],
        this.now(),
      );
      if (retryAfter !== null) delay = Math.max(delay, retryAfter);
    }
    return delay;
  }

  private breakerFor(provider: ExternalProvider): CircuitBreaker {
    let breaker = this.breakers.get(provider);
    if (!breaker) {
      const options = this.policies[provider]?.breaker ?? DEFAULT_BREAKER;
      breaker = new CircuitBreaker({
        ...options,
        now: this.now,
        onStateChange: (state) =>
          this.logger.warn(`Disjoncteur ${provider} : ${state}`),
      });
      this.breakers.set(provider, breaker);
    }
    return breaker;
  }
}
