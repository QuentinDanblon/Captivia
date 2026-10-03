import {
  FILTERED,
  buildSentryOptions,
  isCalendarFeedSampling,
  makeTracesSampler,
  scrubBreadcrumb,
  scrubEvent,
  scrubSpan,
  scrubText,
  scrubTransaction,
  tracesRateFromEnv,
} from './sentry-scrub';

/**
 * Non-régression (revue de sécurité, constat 3) : le jeton du flux iCalendar et les autres
 * secrets (refreshToken, password, code) ne doivent jamais partir chez Sentry.
 * Vérifié aussi de bout en bout avec le SDK réel (sonde : transport factice, aucune fuite).
 */
const SECRET = 'S3cr3tT0k3nValue_abcdefghijklmnopq';
const ICS_URL = `https://api.captivia.app/users/me/agenda.ics?token=${SECRET}`;

type ScrubbedEvent = ReturnType<typeof scrubEvent>;
type ScrubbedTransaction = ReturnType<typeof scrubTransaction>;
type Span = Parameters<typeof scrubSpan>[0];
type SamplingCtx = Parameters<ReturnType<typeof makeTracesSampler>>[0];

const leaks = (value: unknown): boolean =>
  JSON.stringify(value).includes(SECRET);

describe('scrubText', () => {
  it.each([
    [ICS_URL, `https://api.captivia.app/users/me/agenda.ics?token=${FILTERED}`],
    [`token=${SECRET}`, `token=${FILTERED}`],
    [
      `/a?x=1&refreshToken=${SECRET}&y=2`,
      `/a?x=1&refreshToken=${FILTERED}&y=2`,
    ],
    [`/cb?code=${SECRET}#frag`, `/cb?code=${FILTERED}#frag`],
    [
      `password=${SECRET}&Token=${SECRET}`,
      `password=${FILTERED}&Token=${FILTERED}`,
    ],
    [
      `GET /users/me/agenda.ics?token=${SECRET} -> 401`,
      `GET /users/me/agenda.ics?token=${FILTERED} -> 401`,
    ],
    [
      `{"password":"${SECRET}","email":"a@b.c"}`,
      `{"password":"${FILTERED}","email":"a@b.c"}`,
    ],
  ])('masks %s', (input, expected) => {
    expect(scrubText(input)).toBe(expected);
  });

  it('leaves look-alike parameters untouched', () => {
    expect(scrubText('/x?status_code=500&mytoken=1&tokens=2')).toBe(
      '/x?status_code=500&mytoken=1&tokens=2',
    );
  });
});

describe('scrubEvent (erreurs)', () => {
  it('masks the ICS token in request.url, query_string (string, object, pairs), data, headers and breadcrumbs', () => {
    const consoleArgs = [`GET ${ICS_URL}`];
    const event = {
      message: `fail on ${ICS_URL}`,
      transaction: `GET /users/me/agenda.ics?token=${SECRET}`,
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' },
      request: {
        url: ICS_URL,
        query_string: `token=${SECRET}`,
        cookies: { sid: 'x' },
        headers: {
          Authorization: 'Bearer x',
          referer: ICS_URL,
          'user-agent': 'ua',
        },
        data: { password: SECRET, code: SECRET, refreshToken: SECRET, ok: 1 },
      },
      exception: { values: [{ type: 'Error', value: `boom ${ICS_URL}` }] },
      breadcrumbs: [
        { category: 'http', data: { url: ICS_URL, method: 'GET' } },
        {
          category: 'console',
          message: `GET ${ICS_URL}`,
          data: { arguments: consoleArgs },
        },
      ],
      contexts: {
        trace: {
          data: {
            'url.full': ICS_URL,
            'http.url': ICS_URL,
            'http.target': `/users/me/agenda.ics?token=${SECRET}`,
            'http.query': `token=${SECRET}`,
          },
        },
      },
      extra: { nested: { deeper: { url: ICS_URL } } },
    } as unknown as ScrubbedEvent;

    const out = scrubEvent(event);

    expect(leaks(out)).toBe(false);
    expect(out.request?.url).toBe(
      `https://api.captivia.app/users/me/agenda.ics?token=${FILTERED}`,
    );
    expect(out.request?.query_string).toBe(`token=${FILTERED}`);
    expect(out.request?.data).toEqual({
      password: FILTERED,
      code: FILTERED,
      refreshToken: FILTERED,
      ok: 1,
    });
    expect(out.request?.headers).toEqual({
      referer: `https://api.captivia.app/users/me/agenda.ics?token=${FILTERED}`,
      'user-agent': 'ua',
    });
    expect(out.request?.cookies).toBeUndefined();
    expect(out.user).toEqual({ id: 'u1' });
    // Les objets de l'application (ici les arguments de console.log) ne sont pas modifiés.
    expect(consoleArgs[0]).toContain(SECRET);
  });

  it('handles query_string given as an object or as [key, value] pairs', () => {
    const asObject = scrubEvent({
      request: { query_string: { token: SECRET, page: '2' } },
    } as unknown as ScrubbedEvent);
    expect(asObject.request?.query_string).toEqual({
      token: FILTERED,
      page: '2',
    });
    const asPairs = scrubEvent({
      request: {
        query_string: [
          ['token', SECRET],
          ['page', '2'],
        ],
      },
    } as unknown as ScrubbedEvent);
    expect(asPairs.request?.query_string).toEqual([
      ['token', FILTERED],
      ['page', '2'],
    ]);
  });

  it('masks every key ending with "token" (FCM device tokens), in objects and JSON text bodies', () => {
    // Revue de sécurité W6-07, constat 4 : jetons FCM (deviceToken, previousToken…) en clair.
    const out = scrubEvent({
      request: {
        url: 'https://api.captivia.app/users/me/device-tokens',
        data: `{"token":"${SECRET}","previousToken":"${SECRET}","platform":"ios","fcm_token":"${SECRET}"}`,
      },
      extra: {
        deviceToken: SECRET,
        nested: { PreviousToken: SECRET, fcmToken: SECRET, tokens: 2 },
        pairs: [['deviceToken', SECRET]],
      },
      contexts: { push: { DEVICETOKEN: SECRET, platform: 'android' } },
      breadcrumbs: [
        {
          message: `POST /auth/logout {"refreshToken":"${SECRET}","deviceToken":"${SECRET}"}`,
          data: { body: { deviceToken: SECRET } },
        },
      ],
    } as unknown as ScrubbedEvent);
    expect(leaks(out)).toBe(false);
    expect(out.request?.data).toBe(
      `{"token":"${FILTERED}","previousToken":"${FILTERED}","platform":"ios","fcm_token":"${FILTERED}"}`,
    );
    expect(out.extra).toEqual({
      deviceToken: FILTERED,
      nested: { PreviousToken: FILTERED, fcmToken: FILTERED, tokens: 2 },
      pairs: [['deviceToken', FILTERED]],
    });
    expect(out.contexts).toEqual({
      push: { DEVICETOKEN: FILTERED, platform: 'android' },
    });
    expect(
      scrubSpan({ data: { 'push.deviceToken': SECRET } } as unknown as Span)
        .data,
    ).toEqual({ 'push.deviceToken': FILTERED });
  });

  it('keeps generic "code" keys outside of the request (error codes stay readable)', () => {
    const out = scrubEvent({
      extra: { code: 'P2002' },
    } as unknown as ScrubbedEvent);
    expect(out.extra).toEqual({ code: 'P2002' });
  });
});

describe('scrubTransaction / scrubSpan / scrubBreadcrumb (traces)', () => {
  it('masks the transaction name, root span attributes and every child span', () => {
    const tx = {
      type: 'transaction',
      transaction: `GET /users/me/agenda.ics?token=${SECRET}`,
      request: { url: ICS_URL },
      contexts: {
        trace: {
          data: { 'url.full': ICS_URL, 'http.query': `?token=${SECRET}` },
        },
      },
      spans: [
        {
          description: `GET ${ICS_URL}`,
          data: {
            'url.full': ICS_URL,
            'http.url': ICS_URL,
            'http.target': `/users/me/agenda.ics?token=${SECRET}`,
            'http.query': `token=${SECRET}`,
            'url.query': `?token=${SECRET}`,
          },
        },
      ],
    } as unknown as ScrubbedTransaction;

    const out = scrubTransaction(tx);

    expect(leaks(out)).toBe(false);
    expect(out.transaction).toBe(`GET /users/me/agenda.ics?token=${FILTERED}`);
  });

  it('beforeSendSpan masks url.full, http.url, http.target and http.query', () => {
    const span = scrubSpan({
      span_id: '1',
      trace_id: '2',
      start_timestamp: 0,
      description: `GET /users/me/agenda.ics?token=${SECRET}`,
      data: {
        'url.full': ICS_URL,
        'http.url': ICS_URL,
        'http.target': `/users/me/agenda.ics?token=${SECRET}`,
        'http.query': `token=${SECRET}`,
      },
    } as unknown as Span);
    expect(leaks(span)).toBe(false);
    expect(span.data?.['http.query']).toBe(`token=${FILTERED}`);
  });

  it('beforeBreadcrumb returns a cleaned copy', () => {
    const data = { url: ICS_URL };
    const crumb = scrubBreadcrumb({ category: 'http', data });
    expect(leaks(crumb)).toBe(false);
    expect(data.url).toBe(ICS_URL);
  });
});

describe('échantillonnage des traces', () => {
  const ctx = (over: Partial<SamplingCtx>): SamplingCtx =>
    ({
      name: 'GET',
      inheritOrSampleWith: (rate: number) => rate,
      ...over,
    }) as SamplingCtx;
  const sampler = makeTracesSampler(0.25);

  it.each<Partial<SamplingCtx>>([
    { name: 'GET /users/me/agenda.ics' },
    { normalizedRequest: { url: ICS_URL } },
    { attributes: { 'http.target': `/users/me/agenda.ics?token=${SECRET}` } },
    { attributes: { 'url.full': ICS_URL } },
    { attributes: { 'http.route': '/users/me/agenda.ics' } },
  ])('never samples the calendar feed (%o)', (over) => {
    expect(isCalendarFeedSampling(ctx(over))).toBe(true);
    expect(sampler(ctx(over))).toBe(0);
  });

  it('samples other routes at the configured rate (or inherits)', () => {
    expect(sampler(ctx({ name: 'GET /users/me/agenda' }))).toBe(0.25);
    expect(sampler(ctx({ name: 'GET /users/me/agenda.icsx' }))).toBe(0.25);
  });

  it('reads the rate from the environment (0.1 by default)', () => {
    expect(tracesRateFromEnv('0.5')).toBe(0.5);
    expect(tracesRateFromEnv(undefined)).toBe(0.1);
    expect(tracesRateFromEnv('7')).toBe(0.1);
  });

  it('buildSentryOptions wires every hook (no tracesSampleRate bypassing the sampler)', () => {
    const opts = buildSentryOptions({
      dsn: 'https://k@o0.ingest.sentry.io/0',
      tracesSampleRate: 1,
    });
    expect(opts.tracesSampleRate).toBeUndefined();
    expect(opts.sendDefaultPii).toBe(false);
    for (const hook of [
      'tracesSampler',
      'beforeSend',
      'beforeSendTransaction',
      'beforeSendSpan',
      'beforeBreadcrumb',
    ] as const) {
      expect(typeof opts[hook]).toBe('function');
    }
  });
});
