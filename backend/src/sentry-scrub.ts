/**
 * Nettoyage des données sensibles avant envoi à Sentry (revue de sécurité, constat 3).
 *
 * Le jeton du flux iCalendar (`/users/me/agenda.ics?token=…`) est un secret porteur : il
 * apparaissait en clair dans `request.url`, `request.query_string`, les fils d'Ariane, le nom
 * et les attributs des transactions et des spans (`url.full`, `http.url`, `http.target`,
 * `http.query`…). Toutes ces surfaces sont nettoyées ici ; la route du flux est en outre exclue
 * de l'échantillonnage des traces.
 *
 * Module SANS dépendance d'exécution (types seulement) : il est importé par `instrument.ts`,
 * qui doit rester le premier module chargé.
 */
import type { NodeOptions } from '@sentry/nestjs';

type ErrorEvent = Parameters<NonNullable<NodeOptions['beforeSend']>>[0];
type TransactionEvent = Parameters<
  NonNullable<NodeOptions['beforeSendTransaction']>
>[0];
type SpanJSON = Parameters<NonNullable<NodeOptions['beforeSendSpan']>>[0];
type Breadcrumb = Parameters<NonNullable<NodeOptions['beforeBreadcrumb']>>[0];
type SamplingContext = Parameters<NonNullable<NodeOptions['tracesSampler']>>[0];
type AnyEvent = ErrorEvent | TransactionEvent;

export const FILTERED = '[Filtered]';

/** Paramètres de requête / champs dont la valeur est masquée (comparaison insensible à la casse). */
const SENSITIVE_PARAMS = [
  'token',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'password',
  'currentPassword',
  'newPassword',
  'code',
];
/** Clés d'objet masquées partout (hors `code`, trop générique : codes d'erreur Prisma, HTTP…). */
const SENSITIVE_KEYS = new Set(
  [
    ...SENSITIVE_PARAMS.filter((p) => p !== 'code'),
    'passwordHash',
    'calendarToken',
  ].map((k) => k.toLowerCase()),
);
/** Dans le corps et la query d'une requête, `code` est aussi masqué. */
const SENSITIVE_REQUEST_KEYS = new Set([...SENSITIVE_KEYS, 'code']);
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
];

const names = SENSITIVE_PARAMS.join('|');
/** `token=…` dans une URL, une query string ou un texte libre (début, `?`, `&`, `;`, `#`, espace). */
const PARAM_RE = new RegExp(`(^|[?&;#\\s])(${names})=([^&#;\\s"'<>]*)`, 'gi');
/** `"password":"…"` dans un corps JSON resté sous forme de texte. */
const JSON_FIELD_RE = new RegExp(
  `("(?:${names})"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`,
  'gi',
);

/** Route du flux iCalendar : jamais tracée. */
const CALENDAR_FEED_RE = /\/agenda\.ics(?:$|[?#/])/i;

/** Masque les valeurs des paramètres sensibles dans un texte (URL, query string, message…). */
export function scrubText(text: string): string {
  if (!text) return text;
  return text
    .replace(
      PARAM_RE,
      (_m, sep: string, key: string) => `${sep}${key}=${FILTERED}`,
    )
    .replace(
      JSON_FIELD_RE,
      (_m, start: string, _v: string, end: string) =>
        `${start}${FILTERED}${end}`,
    );
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object') return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Copie nettoyée (SANS modifier l'original : les données d'un fil d'Ariane ou d'un contexte
 * peuvent référencer des objets de l'application, comme les arguments de console.log) :
 * chaînes passées à `scrubText`, valeurs des clés sensibles remplacées par `[Filtered]`.
 * Seuls les objets simples et les tableaux sont parcourus ; profondeur bornée (cycles).
 */
function scrubDeep<T>(value: T, keys: Set<string>, depth = 0): T {
  if (typeof value === 'string') return scrubText(value) as T;
  if (depth > 10) return value;
  if (Array.isArray(value)) {
    // Paire [clé, valeur] (query_string au format tableau).
    if (
      value.length === 2 &&
      typeof value[0] === 'string' &&
      keys.has(value[0].toLowerCase())
    ) {
      return [value[0], FILTERED] as T;
    }
    return value.map((v: unknown) => scrubDeep(v, keys, depth + 1)) as T;
  }
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = keys.has(key.toLowerCase())
      ? FILTERED
      : scrubDeep(v, keys, depth + 1);
  }
  return out as T;
}

/** Nettoie toutes les surfaces communes aux événements d'erreur et aux transactions. */
function scrubCommon<T extends AnyEvent>(event: T): T {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  if (event.request) {
    const request = { ...event.request };
    delete request.cookies;
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(
          ([key]) => !SENSITIVE_HEADERS.includes(key.toLowerCase()),
        ),
      );
    }
    // url, query_string (texte, objet ou paires), data (corps), en-têtes restants (Referer…).
    event.request = scrubDeep(request, SENSITIVE_REQUEST_KEYS);
  }
  if (typeof event.transaction === 'string') {
    event.transaction = scrubText(event.transaction);
  }
  if (typeof event.message === 'string') {
    event.message = scrubText(event.message);
  }
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = scrubText(ex.value);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  // contexts.trace.data : attributs du span racine (url.full, http.url, http.target, http.query…).
  if (event.contexts)
    event.contexts = scrubDeep(event.contexts, SENSITIVE_KEYS);
  if (event.extra) event.extra = scrubDeep(event.extra, SENSITIVE_KEYS);
  if (event.tags) event.tags = scrubDeep(event.tags, SENSITIVE_KEYS);
  return event;
}

/** `beforeSend` : événements d'erreur. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  return scrubCommon(event);
}

/** `beforeSendTransaction` : transaction + tous ses spans enfants. */
export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  scrubCommon(event);
  if (event.spans) event.spans = event.spans.map((s) => scrubSpan({ ...s }));
  return event;
}

/** `beforeSendSpan` : description et attributs d'un span (dont url.full, http.url, http.target, http.query). */
export function scrubSpan(span: SpanJSON): SpanJSON {
  if (typeof span.description === 'string') {
    span.description = scrubText(span.description);
  }
  if (span.data) span.data = scrubDeep(span.data, SENSITIVE_KEYS);
  return span;
}

/** `beforeBreadcrumb` : copie nettoyée dès la capture (message, data.url…). */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return scrubDeep({ ...breadcrumb }, SENSITIVE_KEYS);
}

/** Vrai si le span échantillonné concerne le flux iCalendar (nom, attributs ou requête). */
export function isCalendarFeedSampling(ctx: SamplingContext): boolean {
  const attrs = (ctx.attributes ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    ctx.name,
    ctx.normalizedRequest?.url,
    attrs['url.full'],
    attrs['url.path'],
    attrs['http.url'],
    attrs['http.target'],
    attrs['http.route'],
  ];
  return candidates.some(
    (c) => typeof c === 'string' && CALENDAR_FEED_RE.test(c),
  );
}

/** Échantillonneur : le flux iCalendar n'est jamais tracé ; ailleurs, décision parente ou `rate`. */
export function makeTracesSampler(
  rate: number,
): (ctx: SamplingContext) => number {
  return (ctx) =>
    isCalendarFeedSampling(ctx) ? 0 : ctx.inheritOrSampleWith(rate);
}

/** Taux d'échantillonnage des traces depuis l'environnement (0.1 par défaut). */
export function tracesRateFromEnv(raw: string | undefined): number {
  const rate = Number.parseFloat(raw ?? '');
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1;
}

/** Options Sentry communes (hors DSN/env/release) : nettoyage partout + échantillonneur. */
export function buildSentryOptions(
  base: Pick<NodeOptions, 'dsn' | 'environment' | 'release'> & {
    tracesSampleRate: number;
  },
): NodeOptions {
  const { tracesSampleRate, ...rest } = base;
  return {
    ...rest,
    tracesSampler: makeTracesSampler(tracesSampleRate),
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
