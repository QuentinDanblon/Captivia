import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { generateKeyPairSync, randomBytes } from 'crypto';
import { httpServer } from './utils/http';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  AuthRateLimitGuard,
  GuestCreationRateLimitGuard,
} from '../src/common/guards/rate-limit.guard';
import { MailService } from '../src/mail/mail.service';
import { GuestPurgeService } from '../src/auth/guest-purge.service';
import { NativePushSender } from '../src/notifications/native-push-sender';
import {
  FetchLike,
  GOOGLE_OAUTH_TOKEN_URL,
} from '../src/notifications/fcm-client';
import {
  MAX_DEVICE_TOKENS_PER_USER,
  MAX_LOCAL_COVERAGE_MS,
} from '../src/notifications/device-tokens.service';

jest.setTimeout(90_000);

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string };
}
const DAY_MS = 24 * 60 * 60 * 1000;
/** Jeton au format FCM (`<instance>:<jeton>`, base64url). */
const fcmToken = () =>
  `${randomBytes(11).toString('base64url')}:APA91b${randomBytes(110).toString('base64url')}`;

/** FCM simulé : enregistre les messages, répond UNREGISTERED pour les jetons listés. */
const fcmCalls: Array<{ token: string; data: Record<string, string> }> = [];
const gone = new Set<string>();
const fakeFcm: FetchLike = (url, init) => {
  if (url === GOOGLE_OAUTH_TOKEN_URL) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: 'at', expires_in: 3600 }),
    });
  }
  const { message } = JSON.parse(init.body) as {
    message: { token: string; data: Record<string, string> };
  };
  fcmCalls.push({ token: message.token, data: message.data });
  if (gone.has(message.token)) {
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          error: {
            status: 'NOT_FOUND',
            details: [
              {
                '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                errorCode: 'UNREGISTERED',
              },
            ],
          },
        }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ name: 'm' }),
  });
};

function fcmEnv(): NodeJS.ProcessEnv {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    FCM_SERVICE_ACCOUNT_JSON: Buffer.from(
      JSON.stringify({
        type: 'service_account',
        project_id: 'captivia-test',
        client_email: 'fcm@captivia-test.iam.gserviceaccount.com',
        private_key: privateKey,
      }),
    ).toString('base64'),
  };
}

async function buildApp(withFcm: boolean): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(CacheModule)
    .useModule(TestCacheModule)
    .overrideGuard(AuthRateLimitGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(GuestCreationRateLimitGuard)
    .useValue({ canActivate: () => true });
  if (withFcm) {
    const env = fcmEnv();
    builder = builder.overrideProvider(NativePushSender).useFactory({
      factory: (prisma: PrismaService) =>
        new NativePushSender(prisma, { env, fetch: fakeFcm }),
      inject: [PrismaService],
    });
  }
  const moduleFixture: TestingModule = await builder.compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  jest
    .spyOn(app.get(MailService), 'sendEmailVerification')
    .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
  return app;
}

/**
 * W6-07 — Jetons de push natif : enregistrement / retrait authentifiés et validés, transfert d'un
 * jeton au dernier compte, plafond par compte, suppression à la déconnexion, au logout-all, à la
 * suppression du compte et à la purge des invités ; envoi FCM (simulé) et purge UNREGISTERED.
 */
describe('Jetons de push natif (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  const userIds: string[] = [];
  const server = (): App => httpServer(app) as App;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(name: string): Promise<AuthBody> {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email: `device-${name}-${tag}@captivia.local`,
        password: 'DevicePass1234!',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    const body = res.body as AuthBody;
    userIds.push(body.user.id);
    return body;
  }
  const post = (token: string, body: object) =>
    request(server())
      .post('/users/me/device-tokens')
      .set(bearer(token))
      .send(body);
  const del = (token: string, body: object) =>
    request(server())
      .delete('/users/me/device-tokens')
      .set(bearer(token))
      .send(body);
  const rows = (userId: string) =>
    prisma.deviceToken.findMany({ where: { userId } });

  beforeAll(async () => {
    app = await buildApp(false);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
  });

  it('401 sans authentification', async () => {
    await request(server())
      .post('/users/me/device-tokens')
      .send({ token: fcmToken(), platform: 'android' })
      .expect(401);
    await request(server())
      .delete('/users/me/device-tokens')
      .send({ token: fcmToken() })
      .expect(401);
  });

  it('400 sur une entrée invalide (validation stricte)', async () => {
    const { accessToken, user } = await register('invalid');
    const token = fcmToken();
    for (const body of [
      {},
      { token, platform: 'web' },
      { token, platform: 'windows' },
      { token: 'short:token', platform: 'android' },
      { token: `${token} `, platform: 'android' },
      {
        token: 'https://evil.example/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        platform: 'ios',
      },
      { token: 'a'.repeat(5000), platform: 'ios' },
      { token, platform: 'ios', locale: 'xx' },
      { token, platform: 'ios', localRemindersUntil: 'demain' },
      { token, platform: 'ios', previousToken: 'x' },
      { token, platform: 'ios', userId: 'someone-else' },
    ]) {
      await post(accessToken, body).expect(400);
    }
    await del(accessToken, { token: '../../x' }).expect(400);
    expect(await rows(user.id)).toHaveLength(0);
  });

  it('enregistre, puis réenregistre sans doublon (lastSeenAt, langue, couverture locale)', async () => {
    const { accessToken, user } = await register('upsert');
    const token = fcmToken();
    const first = await post(accessToken, {
      token,
      platform: 'android',
      locale: 'en',
    }).expect(200);
    // FCM non configuré dans cette application : enregistré, mais signalé inactif.
    expect(first.body).toEqual({
      enabled: false,
      platform: 'android',
      lastSeenAt: expect.any(String),
    });
    expect(JSON.stringify(first.body)).not.toContain(token);

    const until = new Date(Date.now() + 10 * DAY_MS).toISOString();
    await post(accessToken, {
      token,
      platform: 'android',
      locale: 'de',
      localRemindersUntil: until,
    }).expect(200);
    const [row, ...others] = await rows(user.id);
    expect(others).toHaveLength(0);
    expect(row).toMatchObject({ token, platform: 'android', locale: 'de' });
    expect(row.localRemindersUntil?.toISOString()).toBe(until);
    expect(row.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      row.createdAt.getTime(),
    );

    // Couverture locale déraisonnable (horloge fausse) : ramenée à 31 jours.
    const before = Date.now();
    await post(accessToken, {
      token,
      platform: 'android',
      localRemindersUntil: '2999-01-01T00:00:00.000Z',
    }).expect(200);
    const [clamped] = await rows(user.id);
    expect(clamped.localRemindersUntil!.getTime()).toBeLessThanOrEqual(
      Date.now() + MAX_LOCAL_COVERAGE_MS,
    );
    expect(clamped.localRemindersUntil!.getTime()).toBeGreaterThanOrEqual(
      before + MAX_LOCAL_COVERAGE_MS - 60_000,
    );
    // null : plus aucune couverture locale.
    await post(accessToken, {
      token,
      platform: 'android',
      localRemindersUntil: null,
    }).expect(200);
    expect((await rows(user.id))[0].localRemindersUntil).toBeNull();
  });

  it('un jeton passe au dernier compte qui l’enregistre ; previousToken remplace l’ancien', async () => {
    const a = await register('owner-a');
    const b = await register('owner-b');
    const shared = fcmToken();
    await post(a.accessToken, { token: shared, platform: 'ios' }).expect(200);
    await post(b.accessToken, { token: shared, platform: 'ios' }).expect(200);
    expect(await rows(a.user.id)).toHaveLength(0);
    expect((await rows(b.user.id)).map((r) => r.token)).toEqual([shared]);

    // A ne peut pas retirer le jeton de B.
    await del(a.accessToken, { token: shared }).expect(200);
    expect(await rows(b.user.id)).toHaveLength(1);

    // Rafraîchissement FCM : le nouveau jeton remplace l'ancien.
    const renewed = fcmToken();
    await post(b.accessToken, {
      token: renewed,
      platform: 'ios',
      previousToken: shared,
    }).expect(200);
    expect((await rows(b.user.id)).map((r) => r.token)).toEqual([renewed]);

    await del(b.accessToken, { token: renewed }).expect(200, { success: true });
    await del(b.accessToken, { token: renewed }).expect(200, { success: true });
    expect(await rows(b.user.id)).toHaveLength(0);
  });

  it(`au plus ${MAX_DEVICE_TOKENS_PER_USER} installations par compte (la moins récemment vue est remplacée)`, async () => {
    const { accessToken, user } = await register('cap');
    const tokens = Array.from(
      { length: MAX_DEVICE_TOKENS_PER_USER + 2 },
      fcmToken,
    );
    for (const token of tokens) {
      await post(accessToken, { token, platform: 'android' }).expect(200);
    }
    const kept = (await rows(user.id)).map((r) => r.token).sort();
    expect(kept).toEqual(tokens.slice(2).sort());
  });

  it('déconnexion (deviceToken), logout-all et export RGPD', async () => {
    const acc = await register('logout');
    const t1 = fcmToken();
    const t2 = fcmToken();
    await post(acc.accessToken, {
      token: t1,
      platform: 'android',
      locale: 'fr',
    }).expect(200);
    await post(acc.accessToken, { token: t2, platform: 'ios' }).expect(200);

    // Export : installations sans le jeton.
    const exp = await request(server())
      .get('/users/me/export')
      .set(bearer(acc.accessToken))
      .expect(200);
    const installs = (exp.body as { appInstallations: object[] })
      .appInstallations;
    expect(installs).toHaveLength(2);
    for (const i of installs) {
      expect(Object.keys(i).sort()).toEqual([
        'createdAt',
        'id',
        'lastSeenAt',
        'locale',
        'platform',
      ]);
    }
    expect(JSON.stringify(exp.body)).not.toContain(t1);

    // Déconnexion de cet appareil : son jeton seulement.
    await request(server())
      .post('/auth/logout')
      .send({ refreshToken: acc.refreshToken, deviceToken: t1 })
      .expect(200);
    expect((await rows(acc.user.id)).map((r) => r.token)).toEqual([t2]);

    // Se reconnecter puis « tous les appareils » : plus aucun jeton.
    const login = await request(server())
      .post('/auth/login')
      .send({
        email: `device-logout-${tag}@captivia.local`,
        password: 'DevicePass1234!',
      })
      .expect(200);
    await request(server())
      .post('/auth/logout-all')
      .set(bearer((login.body as AuthBody).accessToken))
      .expect(200);
    expect(await rows(acc.user.id)).toHaveLength(0);
  });

  it('suppression du compte : jetons supprimés', async () => {
    const acc = await register('delete');
    await post(acc.accessToken, {
      token: fcmToken(),
      platform: 'android',
    }).expect(200);
    await request(server())
      .delete('/users/me')
      .set(bearer(acc.accessToken))
      .send({ password: 'DevicePass1234!' })
      .expect(204);
    expect(await rows(acc.user.id)).toHaveLength(0);
  });

  it('purge RGPD des invités inactifs : jetons supprimés avec le compte', async () => {
    const res = await request(server())
      .post('/auth/guest')
      .send({ locale: 'fr' })
      .expect(201);
    const guest = res.body as AuthBody;
    userIds.push(guest.user.id);
    await post(guest.accessToken, {
      token: fcmToken(),
      platform: 'ios',
    }).expect(200);
    expect(await rows(guest.user.id)).toHaveLength(1);

    await prisma.user.update({
      where: { id: guest.user.id },
      data: { lastActiveAt: new Date(Date.now() - 91 * DAY_MS) },
    });
    await app.get(GuestPurgeService).runOnce(new Date(), 90);
    expect(
      await prisma.user.findUnique({ where: { id: guest.user.id } }),
    ).toBeNull();
    expect(await rows(guest.user.id)).toHaveLength(0);
  });

  describe('avec FCM configuré (transport simulé)', () => {
    let fcmApp: INestApplication;
    const fcmServer = (): App => httpServer(fcmApp) as App;

    beforeAll(async () => {
      fcmApp = await buildApp(true);
    });
    afterAll(async () => {
      if (fcmApp) await fcmApp.close();
    });

    it('notification de test : Web Push et natif ; jeton UNREGISTERED purgé', async () => {
      const res = await request(fcmServer())
        .post('/auth/register')
        .send({
          email: `device-fcm-${tag}@captivia.local`,
          password: 'DevicePass1234!',
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(201);
      const acc = res.body as AuthBody;
      userIds.push(acc.user.id);
      const live = fcmToken();
      const dead = fcmToken();
      gone.add(dead);

      for (const token of [live, dead]) {
        const r = await request(fcmServer())
          .post('/users/me/device-tokens')
          .set(bearer(acc.accessToken))
          .send({ token, platform: 'android' })
          .expect(200);
        expect((r.body as { enabled: boolean }).enabled).toBe(true);
      }

      fcmCalls.length = 0;
      const sent = await request(fcmServer())
        .post('/users/me/test-notification')
        .set(bearer(acc.accessToken))
        .expect(201);
      expect(sent.body).toEqual({ sent: true });
      expect(fcmCalls.map((c) => c.token).sort()).toEqual([live, dead].sort());
      expect(fcmCalls[0].data.kind).toBe('captivia-push');
      expect((await rows(acc.user.id)).map((r) => r.token)).toEqual([live]);
    });
  });
});
