import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AuthBody, ErrorBody, bodyOf, httpServer } from './utils/http';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** W6-08 — Webhook RevenueCat (achats intégrés App Store / Google Play). */
/** Réponse (partielle) de `GET /users/me/subscription` consultée par ces tests. */
interface SubscriptionStatus {
  premium: boolean;
  status?: string;
  manageUrl?: string | null;
}
/** Réponse du webhook RevenueCat. */
interface WebhookOutcome {
  outcome: string;
}

describe('IAP RevenueCat webhook (W6-08)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const SECRET = 'rc-webhook-secret-test-0123456789abcdef';
  const previousSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const DAY = 24 * 3600 * 1000;

  const register = async (email: string) => {
    const res = await request(httpServer(app))
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    return {
      token: bodyOf<AuthBody>(res).accessToken,
      id: bodyOf<AuthBody>(res).user.id,
    };
  };

  const send = (event: Record<string, unknown>, auth = `Bearer ${SECRET}`) =>
    request(httpServer(app))
      .post('/webhooks/revenuecat')
      .set('Authorization', auth)
      .send({ api_version: '1.0', event });

  const rcEvent = (
    userId: string,
    type: string,
    over: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: randomUUID(),
    type,
    app_user_id: userId,
    original_app_user_id: userId,
    product_id: 'captivia_premium_monthly',
    entitlement_ids: ['premium'],
    store: 'APP_STORE',
    environment: 'SANDBOX',
    original_transaction_id: `otx-${userId}`,
    transaction_id: `tx-${randomUUID()}`,
    event_timestamp_ms: Date.now(),
    expiration_at_ms: Date.now() + 30 * DAY,
    ...over,
  });

  const status = async (token: string) =>
    bodyOf<SubscriptionStatus>(
      await request(httpServer(app))
        .get('/users/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200),
    );

  beforeAll(async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (previousSecret === undefined)
      delete process.env.REVENUECAT_WEBHOOK_SECRET;
    else process.env.REVENUECAT_WEBHOOK_SECRET = previousSecret;
    await app.close();
  });

  it('401 sans secret ou avec un mauvais secret', async () => {
    const u = await register(`iap-auth-${stamp}@captivia.com`);
    await request(httpServer(app))
      .post('/webhooks/revenuecat')
      .send({ event: rcEvent(u.id, 'INITIAL_PURCHASE') })
      .expect(401);
    await send(rcEvent(u.id, 'INITIAL_PURCHASE'), 'Bearer wrong-secret').expect(
      401,
    );
    await send(rcEvent(u.id, 'INITIAL_PURCHASE'), SECRET.slice(0, -1)).expect(
      401,
    );
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(
      0,
    );
  });

  it('INITIAL_PURCHASE → premium ; rejeu du même event.id idempotent ; EXPIRATION → non premium', async () => {
    const u = await register(`iap-buy-${stamp}@captivia.com`);
    expect((await status(u.token)).premium).toBe(false);

    const purchase = rcEvent(u.id, 'INITIAL_PURCHASE');
    const r1 = await send(purchase).expect(200);
    expect(bodyOf<WebhookOutcome>(r1).outcome).toBe('applied');
    const s1 = await status(u.token);
    expect(s1).toMatchObject({
      premium: true,
      isPremium: true,
      source: 'APPLE',
      status: 'ACTIVE',
      productId: 'captivia_premium_monthly',
      willRenew: true,
      manageUrl: 'https://apps.apple.com/account/subscriptions',
    });
    const me = await request(httpServer(app))
      .get('/auth/me')
      .set('Authorization', `Bearer ${u.token}`)
      .expect(200);
    expect(bodyOf<{ isPremium: boolean }>(me).isPremium).toBe(true);

    const r2 = await send(purchase).expect(200);
    expect(bodyOf<WebhookOutcome>(r2).outcome).toBe('duplicate');
    expect(
      await prisma.paymentEvent.count({
        where: { eventId: purchase.id as string },
      }),
    ).toBe(1);
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(
      1,
    );

    await send(
      rcEvent(u.id, 'EXPIRATION', { expiration_at_ms: Date.now() - 1000 }),
    ).expect(200);
    const s2 = await status(u.token);
    expect(s2.premium).toBe(false);
    expect(s2.status).toBe('EXPIRED');
  });

  it("CANCELLATION conserve l'accès jusqu'à l'échéance ; remboursement → accès retiré", async () => {
    const u = await register(`iap-cancel-${stamp}@captivia.com`);
    await send(
      rcEvent(u.id, 'INITIAL_PURCHASE', { store: 'PLAY_STORE' }),
    ).expect(200);
    await send(
      rcEvent(u.id, 'CANCELLATION', {
        store: 'PLAY_STORE',
        cancel_reason: 'UNSUBSCRIBE',
      }),
    ).expect(200);
    const s1 = await status(u.token);
    expect(s1).toMatchObject({
      premium: true,
      status: 'CANCELLED',
      willRenew: false,
      source: 'GOOGLE',
    });
    expect(s1.manageUrl).toContain('play.google.com');

    await send(
      rcEvent(u.id, 'CANCELLATION', {
        store: 'PLAY_STORE',
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    ).expect(200);
    const s2 = await status(u.token);
    expect(s2.premium).toBe(false);
    expect(s2.status).toBe('REFUNDED');
  });

  it('un événement plus ancien que le dernier appliqué est ignoré', async () => {
    const u = await register(`iap-stale-${stamp}@captivia.com`);
    await send(rcEvent(u.id, 'INITIAL_PURCHASE')).expect(200);
    const stale = await send(
      rcEvent(u.id, 'EXPIRATION', {
        event_timestamp_ms: Date.now() - 3600_000,
      }),
    ).expect(200);
    expect(bodyOf<WebhookOutcome>(stale).outcome).toBe('ignored_stale');
    expect((await status(u.token)).premium).toBe(true);
  });

  it('app_user_id inconnu → 200 sans création', async () => {
    const ghost = randomUUID();
    const res = await send(rcEvent(ghost, 'INITIAL_PURCHASE')).expect(200);
    expect(bodyOf<WebhookOutcome>(res).outcome).toBe('ignored_unknown_user');
    expect(
      await prisma.subscription.count({
        where: { originalTransactionId: `otx-${ghost}` },
      }),
    ).toBe(0);
    expect(await prisma.user.count({ where: { id: ghost } })).toBe(0);
  });

  it('un opérateur reste premium sans abonnement', async () => {
    const u = await register(`iap-op-${stamp}@captivia.com`);
    await prisma.user.update({
      where: { id: u.id },
      data: { role: 'OPERATOR' },
    });
    const s = await status(u.token);
    expect(s).toMatchObject({
      premium: true,
      source: 'MANUAL',
      manageUrl: null,
    });
  });

  it('la limite « 1 animal gratuit » tombe pour un abonné store', async () => {
    const u = await register(`iap-limit-${stamp}@captivia.com`);
    const create = (name: string) =>
      request(httpServer(app))
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ speciesId: 5221172, name });
    await create('Un').expect(201);
    await create('Deux').expect(403);
    await send(rcEvent(u.id, 'INITIAL_PURCHASE')).expect(200);
    await create('Deux').expect(201);
  });

  it('POST /users/me/subscription reste 501 (abonnement uniquement dans l’app mobile)', async () => {
    const u = await register(`iap-web-${stamp}@captivia.com`);
    const res = await request(httpServer(app))
      .post('/users/me/subscription')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ plan: 'monthly' })
      .expect(501);
    expect(bodyOf<ErrorBody>(res).message).toContain('application mobile');
  });
});
