import { generateKeyPairSync, verify } from 'crypto';
import {
  FCM_SCOPE,
  FcmClient,
  FetchLike,
  GOOGLE_OAUTH_TOKEN_URL,
  classifyFcmError,
  fcmSendUrl,
} from './fcm-client';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const account = {
  projectId: 'captivia-app',
  clientEmail: 'fcm@captivia-app.iam.gserviceaccount.com',
  privateKey,
};

type Call = { url: string; headers: Record<string, string>; body: string };
const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

/** Transport simulé : jeton OAuth puis réponses FCM successives. */
function fakeFetch(
  fcmResponses: Array<{ status: number; body?: unknown }>,
  tokenResponse: { status: number; body: unknown } = {
    status: 200,
    body: { access_token: 'ya29.token', expires_in: 3600 },
  },
) {
  const calls: Call[] = [];
  const queue = [...fcmResponses];
  const impl: FetchLike = (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    if (url === GOOGLE_OAUTH_TOKEN_URL) {
      return Promise.resolve(json(tokenResponse.status, tokenResponse.body));
    }
    const next = queue.shift() ?? { status: 200, body: { name: 'm/1' } };
    return Promise.resolve(json(next.status, next.body ?? {}));
  };
  return { impl: jest.fn(impl), calls };
}

const message = {
  token: 'device-token',
  notification: { title: 't', body: 'b' },
};

describe('FcmClient', () => {
  it('signe une assertion JWT RS256 vérifiable (iss, scope, aud, exp)', () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const client = new FcmClient(account, undefined, () => now);
    const [h, c, s] = client.createAssertion().split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({
      iss: account.clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${h}.${c}`),
        publicKey,
        Buffer.from(s, 'base64url'),
      ),
    ).toBe(true);
  });

  it('échange le jeton une fois, le met en cache, puis envoie le message', async () => {
    const { impl, calls } = fakeFetch([{ status: 200 }, { status: 200 }]);
    const client = new FcmClient(account, impl);
    await expect(client.send(message)).resolves.toEqual({ ok: true });
    await expect(client.send(message)).resolves.toEqual({ ok: true });

    const tokenCalls = calls.filter((c) => c.url === GOOGLE_OAUTH_TOKEN_URL);
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0].body).toContain(
      'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer',
    );
    const sends = calls.filter((c) => c.url === fcmSendUrl('captivia-app'));
    expect(sends).toHaveLength(2);
    expect(sends[0].url).toBe(
      'https://fcm.googleapis.com/v1/projects/captivia-app/messages:send',
    );
    expect(sends[0].headers.Authorization).toBe('Bearer ya29.token');
    expect(JSON.parse(sends[0].body)).toEqual({ message });
  });

  it('renouvelle le jeton 5 min avant son expiration', async () => {
    let now = 0;
    const { impl, calls } = fakeFetch([]);
    const client = new FcmClient(account, impl, () => now);
    await client.send(message);
    now = 54 * 60 * 1000; // 54 min : encore valable
    await client.send(message);
    now = 56 * 60 * 1000; // 56 min : renouvelé
    await client.send(message);
    expect(calls.filter((c) => c.url === GOOGLE_OAUTH_TOKEN_URL)).toHaveLength(
      2,
    );
  });

  it('échanges simultanés : un seul appel à Google', async () => {
    const { impl, calls } = fakeFetch([]);
    const client = new FcmClient(account, impl);
    await Promise.all([client.send(message), client.send(message)]);
    expect(calls.filter((c) => c.url === GOOGLE_OAUTH_TOKEN_URL)).toHaveLength(
      1,
    );
  });

  it('jeton refusé par Google : échec AUTH, aucun envoi, rien ne lève', async () => {
    const { impl, calls } = fakeFetch([], {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid JWT' },
    });
    const res = await new FcmClient(account, impl).send(message);
    expect(res).toMatchObject({
      ok: false,
      errorCode: 'AUTH',
      invalidToken: false,
    });
    expect(res.ok === false && res.message).toContain('invalid_grant');
    expect(calls.some((c) => c.url.startsWith('https://fcm.'))).toBe(false);
  });

  it('401 de FCM : le jeton d’accès est oublié et redemandé au prochain envoi', async () => {
    const { impl, calls } = fakeFetch([
      { status: 401, body: { error: { status: 'UNAUTHENTICATED' } } },
      { status: 200 },
    ]);
    const client = new FcmClient(account, impl);
    expect((await client.send(message)).ok).toBe(false);
    expect((await client.send(message)).ok).toBe(true);
    expect(calls.filter((c) => c.url === GOOGLE_OAUTH_TOKEN_URL)).toHaveLength(
      2,
    );
  });

  it('erreur réseau : échec sans lever', async () => {
    const impl: FetchLike = jest.fn((url: string) =>
      url === GOOGLE_OAUTH_TOKEN_URL
        ? Promise.resolve(json(200, { access_token: 'x', expires_in: 3600 }))
        : Promise.reject(new Error('ECONNRESET')),
    );
    const res = await new FcmClient(account, impl).send(message);
    expect(res).toMatchObject({ ok: false, status: 0, invalidToken: false });
  });
});

describe('classifyFcmError', () => {
  const fcmError = (
    status: string,
    errorCode: string,
    extra: object[] = [],
    msg = '',
  ) => ({
    error: {
      status,
      message: msg,
      details: [
        {
          '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
          errorCode,
        },
        ...extra,
      ],
    },
  });

  it('UNREGISTERED (404) : jeton à purger', () => {
    expect(
      classifyFcmError(404, fcmError('NOT_FOUND', 'UNREGISTERED')),
    ).toMatchObject({ errorCode: 'UNREGISTERED', invalidToken: true });
  });

  it('SENDER_ID_MISMATCH (403) : jeton d’un autre projet, à purger', () => {
    expect(
      classifyFcmError(
        403,
        fcmError('PERMISSION_DENIED', 'SENDER_ID_MISMATCH'),
      ),
    ).toMatchObject({ invalidToken: true });
  });

  it('INVALID_ARGUMENT visant le jeton : à purger', () => {
    const viaField = fcmError('INVALID_ARGUMENT', 'INVALID_ARGUMENT', [
      {
        '@type': 'type.googleapis.com/google.rpc.BadRequest',
        fieldViolations: [
          { field: 'message.token', description: 'Invalid registration token' },
        ],
      },
    ]);
    expect(classifyFcmError(400, viaField).invalidToken).toBe(true);
    const viaMessage = fcmError(
      'INVALID_ARGUMENT',
      'INVALID_ARGUMENT',
      [],
      'The registration token is not a valid FCM registration token',
    );
    expect(classifyFcmError(400, viaMessage).invalidToken).toBe(true);
  });

  it('INVALID_ARGUMENT sur un autre champ (notre message) : conservé', () => {
    const payloadBug = fcmError('INVALID_ARGUMENT', 'INVALID_ARGUMENT', [
      {
        '@type': 'type.googleapis.com/google.rpc.BadRequest',
        fieldViolations: [
          { field: 'message.android.ttl', description: 'Invalid duration' },
        ],
      },
    ]);
    expect(classifyFcmError(400, payloadBug).invalidToken).toBe(false);
  });

  it.each([
    [429, 'QUOTA_EXCEEDED'],
    [503, 'UNAVAILABLE'],
    [500, 'INTERNAL'],
    [401, 'THIRD_PARTY_AUTH_ERROR'],
  ])('%s %s : transitoire ou configuration, jeton conservé', (status, code) => {
    expect(classifyFcmError(status, fcmError('X', code))).toMatchObject({
      errorCode: code,
      invalidToken: false,
    });
  });

  it('corps illisible : statut seul, jeton conservé', () => {
    expect(classifyFcmError(502, null)).toEqual({
      ok: false,
      status: 502,
      errorCode: null,
      invalidToken: false,
      message: '',
    });
  });
});
