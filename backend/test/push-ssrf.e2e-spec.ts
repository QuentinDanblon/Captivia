import * as net from 'net';
import * as crypto from 'crypto';
import * as webPush from 'web-push';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { httpServer } from './utils/http';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { AuthRateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '../src/notifications/notifications.service';

jest.setTimeout(60_000);

/**
 * Non-régression (revue de sécurité, constat 2) : Web Push ne doit plus servir de SSRF aveugle.
 * - un endpoint hors liste blanche (IP interne, port exotique, hôte inconnu) est refusé (400) ;
 * - une ligne déjà en base vers une adresse interne n'est JAMAIS appelée (revérification à l'envoi) ;
 * - POST /users/me/test-notification ne renvoie que `{ sent: boolean }` (plus d'oracle) ;
 * - au plus 10 abonnements par compte (le plus ancien est remplacé).
 * Aucun appel réseau externe : seuls des endpoints refusés sont « envoyés ».
 */
describe('Web Push — SSRF et oracle (constat 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let blackHole: net.Server;
  let port: number;
  const connections: string[] = [];
  const savedEnv = {
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
  };
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  const server = (): App => httpServer(app) as App;
  const keys = {
    // Clé publique P-256 valide (65 octets) : le chiffrement web-push réussirait.
    p256dh: crypto
      .createECDH('prime256v1')
      .generateKeys()
      .toString('base64url'),
    auth: 'AAAAAAAAAAAAAAAAAAAAAA',
  };

  async function register(name: string) {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email: `ssrf-${name}-${tag}@captivia.local`,
        password: 'SsrfPass1234!',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    return {
      token: (res.body as { accessToken: string }).accessToken,
      id: (res.body as { user: { id: string } }).user.id,
    };
  }
  const subscribe = (token: string, endpoint: string) =>
    request(server())
      .post('/users/me/push-subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint, keys });

  beforeAll(async () => {
    // Trou noir local : accepte la connexion TCP et ne répond jamais.
    blackHole = net.createServer((socket) => {
      connections.push(`${socket.remoteAddress} -> ${socket.localPort}`);
    });
    await new Promise<void>((r) => blackHole.listen(0, '127.0.0.1', () => r()));
    port = (blackHole.address() as net.AddressInfo).port;

    const vapid = webPush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
    process.env.VAPID_PRIVATE_KEY = vapid.privateKey;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jest
      .spyOn(app.get(MailService), 'sendEmailVerification')
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { endsWith: `-${tag}@captivia.local` } },
      });
    }
    if (app) await app.close();
    blackHole?.close();
    process.env.VAPID_PUBLIC_KEY = savedEnv.pub;
    process.env.VAPID_PRIVATE_KEY = savedEnv.priv;
    if (savedEnv.pub === undefined) delete process.env.VAPID_PUBLIC_KEY;
    if (savedEnv.priv === undefined) delete process.env.VAPID_PRIVATE_KEY;
  });

  it('refuse (400) un endpoint interne, sur un port exotique ou hors liste blanche', async () => {
    const { token, id } = await register('dto');
    for (const endpoint of [
      `https://127.0.0.1:${port}/internal/admin`,
      'https://169.254.169.254/latest/meta-data/',
      'https://localhost/x',
      `https://fcm.googleapis.com:${port}/fcm/send/x`,
      'https://push.example.com/send/x',
      'http://fcm.googleapis.com/fcm/send/x',
    ]) {
      await subscribe(token, endpoint).expect(400);
    }
    expect(await prisma.pushSubscription.count({ where: { userId: id } })).toBe(
      0,
    );
    expect(connections).toEqual([]);
  });

  it("une ligne héritée vers une adresse interne n'est jamais appelée ; test-notification ne renvoie que { sent: false }", async () => {
    const { token, id } = await register('legacy');
    await prisma.pushSubscription.create({
      data: {
        userId: id,
        endpoint: `https://127.0.0.1:${port}/internal/admin`,
        keys,
      },
    });

    const t0 = Date.now();
    const res = await request(server())
      .post('/users/me/test-notification')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const elapsed = Date.now() - t0;

    expect(res.body).toEqual({ sent: false });
    expect(elapsed).toBeLessThan(2_000);
    await new Promise((r) => setTimeout(r, 100));
    expect(connections).toEqual([]);
  });

  it(`plafonne à ${MAX_PUSH_SUBSCRIPTIONS_PER_USER} abonnements par compte : le plus ancien est remplacé`, async () => {
    const { token, id } = await register('cap');
    const endpoint = (n: number) =>
      `https://fcm.googleapis.com/fcm/send/${tag}-cap-${n}`;
    for (let n = 1; n <= MAX_PUSH_SUBSCRIPTIONS_PER_USER + 2; n++) {
      await subscribe(token, endpoint(n)).expect(201);
    }
    const rows = await prisma.pushSubscription.findMany({
      where: { userId: id },
      select: { endpoint: true },
    });
    expect(rows).toHaveLength(MAX_PUSH_SUBSCRIPTIONS_PER_USER);
    const kept = new Set(rows.map((r) => r.endpoint));
    expect(kept.has(endpoint(1))).toBe(false);
    expect(kept.has(endpoint(2))).toBe(false);
    expect(kept.has(endpoint(MAX_PUSH_SUBSCRIPTIONS_PER_USER + 2))).toBe(true);

    // Mettre à jour un abonnement existant ne supprime rien.
    await subscribe(token, endpoint(3)).expect(201);
    expect(await prisma.pushSubscription.count({ where: { userId: id } })).toBe(
      MAX_PUSH_SUBSCRIPTIONS_PER_USER,
    );
  });
});
