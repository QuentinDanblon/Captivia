import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthBody, bodyOf, httpServer } from './utils/http';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * W1-08 (domaine) — limite « 1 animal gratuit » sans course ;
 * abonnement push : endpoint https et propriété de l'endpoint.
 */
describe('Free animal limit and push subscriptions (W1-08)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const users: { token: string; id: string }[] = [];

  const register = async (label: string) => {
    const res = await request(httpServer(app))
      .post('/auth/register')
      .send({
        email: `w108-${label}-${stamp}@captivia.com`,
        password: 'password123',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    const u = {
      token: bodyOf<AuthBody>(res).accessToken,
      id: bodyOf<AuthBody>(res).user.id,
    };
    users.push(u);
    return u;
  };

  beforeAll(async () => {
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
    for (const u of users) {
      await prisma.animal.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    }
    if (app) await app.close();
  });

  describe('free animal limit', () => {
    it('lets exactly one of N parallel creations succeed on a free account', async () => {
      const u = await register('race');
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          request(httpServer(app))
            .post('/users/me/animals')
            .set('Authorization', `Bearer ${u.token}`)
            .send({ speciesId: 5221172, name: `Racer ${i}` }),
        ),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 403)).toHaveLength(7);
      expect(await prisma.animal.count({ where: { userId: u.id } })).toBe(1);
    });

    it('still allows several animals for a premium account, in parallel', async () => {
      const u = await register('premium');
      await prisma.user.update({
        where: { id: u.id },
        data: { isPremium: true },
      });
      const results = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          request(httpServer(app))
            .post('/users/me/animals')
            .set('Authorization', `Bearer ${u.token}`)
            .send({ speciesId: 5221172, name: `Premium ${i}` }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    });
  });

  describe('push subscriptions', () => {
    const endpoint = () =>
      `https://fcm.googleapis.com/fcm/send/${stamp}-${Math.random().toString(36).slice(2)}`;
    const keys = { p256dh: 'BKey-p256dh', auth: 'auth-secret' };
    let owner: { token: string; id: string };
    let other: { token: string; id: string };

    beforeAll(async () => {
      owner = await register('push-owner');
      other = await register('push-other');
    });

    const subscribe = (token: string, body: object) =>
      request(httpServer(app))
        .post('/users/me/push-subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('rejects non-https endpoints', async () => {
      await subscribe(owner.token, {
        endpoint: 'http://push.example.com/x',
        keys,
      }).expect(400);
      await subscribe(owner.token, {
        endpoint: 'javascript:alert(1)',
        keys,
      }).expect(400);
      await subscribe(owner.token, { endpoint: 'not a url', keys }).expect(400);
    });

    it('registers a subscription and lets the owner refresh its keys', async () => {
      const ep = endpoint();
      await subscribe(owner.token, { endpoint: ep, keys }).expect(201);
      await subscribe(owner.token, {
        endpoint: ep,
        keys: { ...keys, auth: 'rotated' },
      }).expect(201);
      const sub = await prisma.pushSubscription.findUnique({
        where: { endpoint: ep },
      });
      expect(sub!.userId).toBe(owner.id);
      expect((sub!.keys as { auth: string }).auth).toBe('rotated');
    });

    it('refuses (403) an endpoint that belongs to another user and leaves it untouched', async () => {
      const ep = endpoint();
      await subscribe(owner.token, { endpoint: ep, keys }).expect(201);

      await subscribe(other.token, {
        endpoint: ep,
        keys: { p256dh: 'attacker', auth: 'attacker' },
      }).expect(403);

      const sub = await prisma.pushSubscription.findUnique({
        where: { endpoint: ep },
      });
      expect(sub!.userId).toBe(owner.id);
      expect((sub!.keys as { p256dh: string }).p256dh).toBe(keys.p256dh);
    });

    it('handles concurrent registrations of the same endpoint by two users', async () => {
      const ep = endpoint();
      const [a, b] = await Promise.all([
        subscribe(owner.token, { endpoint: ep, keys }),
        subscribe(other.token, { endpoint: ep, keys }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 403]);
    });
  });
});
