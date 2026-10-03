import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  AuthRateLimitGuard,
  GUEST_CREATION_LIMIT,
  GuestCreationRateLimitGuard,
} from '../src/common/guards/rate-limit.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { GuestPurgeService } from '../src/auth/guest-purge.service';

jest.setTimeout(90000);

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    isGuest: boolean;
    emailVerified: boolean;
  };
}
const auth = (res: { body: unknown }): AuthBody => res.body as AuthBody;
const sha256 = (v: string) =>
  crypto.createHash('sha256').update(v).digest('hex');
const DAY_MS = 24 * 60 * 60 * 1000;
const todayStr = () => new Date().toISOString().slice(0, 10);

async function buildApp(throttled: boolean): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(CacheModule)
    .useModule(TestCacheModule)
    .overrideGuard(AuthRateLimitGuard)
    .useValue({ canActivate: () => true });
  if (!throttled) {
    builder = builder
      .overrideGuard(GuestCreationRateLimitGuard)
      .useValue({ canActivate: () => true });
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
  // Filtre de production : vérifie que le code GUEST_ACCOUNT parvient bien au client.
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

/**
 * Mode invité (« Essayer sans compte ») et D-16 : création, limite d'un animal, carnet complet
 * sans Premium, actions réservées aux comptes (403 GUEST_ACCOUNT), conversion en compte sans
 * perte de données, 409 sur e-mail pris, purge des invités inactifs, limitation par IP.
 */
describe('Mode invité (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let sendVerification: jest.SpyInstance;
  const tag = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emailFor = (name: string) => `guest-${name}-${tag}@captivia.local`;
  const guestIds: string[] = [];
  const server = (): App => app.getHttpServer() as App;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createGuest(): Promise<AuthBody> {
    const res = await request(server())
      .post('/auth/guest')
      .set('User-Agent', 'jest-guest')
      .send({ locale: 'en' })
      .expect(201);
    guestIds.push(auth(res).user.id);
    return auth(res);
  }

  function createAnimal(token: string, name: string) {
    return request(server())
      .post('/users/me/animals')
      .set(bearer(token))
      .send({ speciesId: 5221172, name });
  }

  beforeAll(async () => {
    app = await buildApp(false);
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    sendVerification = jest
      .spyOn(mail, 'sendEmailVerification')
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: {
          OR: [
            { id: { in: guestIds } },
            { email: { endsWith: `-${tag}@captivia.local` } },
          ],
        },
      });
    }
    if (app) await app.close();
  });

  describe('POST /auth/guest', () => {
    it('crée un invité sans e-mail ni mot de passe et renvoie la paire de jetons', async () => {
      const guest = await createGuest();
      expect(guest.accessToken).toEqual(expect.any(String));
      expect(guest.refreshToken).toMatch(/^[a-f0-9]{64}$/);
      expect(guest.user).toMatchObject({
        isGuest: true,
        email: null,
        emailVerified: false,
      });

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: guest.user.id },
      });
      expect(row).toMatchObject({
        isGuest: true,
        email: null,
        passwordHash: null,
        locale: 'en',
        role: 'USER',
        isPremium: false,
      });
      expect(Date.now() - row.lastActiveAt.getTime()).toBeLessThan(60_000);

      // Refresh token haché, valable jusqu'à la purge (90 jours par défaut).
      const rt = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(guest.refreshToken) },
      });
      expect(rt.userAgent).toBe('jest-guest');
      const ttlDays =
        (rt.expiresAt.getTime() - rt.createdAt.getTime()) / DAY_MS;
      expect(ttlDays).toBeGreaterThan(89.9);

      const me = await request(server())
        .get('/auth/me')
        .set(bearer(guest.accessToken))
        .expect(200);
      expect(me.body).toMatchObject({
        id: guest.user.id,
        isGuest: true,
        email: null,
      });

      // Aucun e-mail n'est envoyé à la création d'un invité.
      expect(sendVerification).not.toHaveBeenCalled();
    });

    it('refuse les champs inconnus (aucune donnée personnelle acceptée)', async () => {
      await request(server())
        .post('/auth/guest')
        .send({ email: 'x@y.z' })
        .expect(400);
    });

    it('la session invité suit la rotation des refresh tokens', async () => {
      const guest = await createGuest();
      const rotated = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: guest.refreshToken })
        .expect(200);
      expect(auth(rotated).refreshToken).not.toBe(guest.refreshToken);
      await request(server())
        .get('/auth/me')
        .set(bearer(auth(rotated).accessToken))
        .expect(200);
    });

    it('un invité ne peut pas se connecter par /auth/login', async () => {
      // Aucun e-mail : rien à présenter. Défense en profondeur côté service : jamais de session.
      await request(server())
        .post('/auth/login')
        .send({ email: 'guest@captivia.local', password: 'whatever-123' })
        .expect(401);
    });
  });

  describe('D-16 : 1 animal, carnet complet sans Premium', () => {
    let guest: AuthBody;
    let animalId: string;

    beforeAll(async () => {
      guest = await createGuest();
    });

    it('1er animal accepté, 2e refusé (403 ANIMAL_LIMIT)', async () => {
      const first = await createAnimal(guest.accessToken, 'Kaa').expect(201);
      animalId = (first.body as { id: string }).id;

      const second = await createAnimal(guest.accessToken, 'Nagini').expect(
        403,
      );
      expect(second.body).toMatchObject({
        statusCode: 403,
        code: 'ANIMAL_LIMIT',
      });
      expect(
        await prisma.animal.count({ where: { userId: guest.user.id } }),
      ).toBe(1);
    });

    it('carnet complet accessible sans Premium (soins, vaccins, pesées, médicaments, RDV, export, agenda)', async () => {
      const base = `/users/me/animals/${animalId}`;
      const h = bearer(guest.accessToken);
      await request(server())
        .post(`${base}/health-records`)
        .set(h)
        .send({ type: 'vaccine', title: 'Bilan', date: todayStr() })
        .expect(201);
      await request(server())
        .post(`${base}/vaccinations`)
        .set(h)
        .send({ name: 'Rage', date: todayStr() })
        .expect(201);
      await request(server())
        .post(`${base}/measurements`)
        .set(h)
        .send({ weightKg: 2.34, measuredAt: todayStr() })
        .expect(201);
      await request(server())
        .post(`${base}/medications`)
        .set(h)
        .send({
          name: 'Vermifuge',
          dose: '0,2 ml',
          frequency: 'daily',
          startDate: todayStr(),
        })
        .expect(201);
      await request(server())
        .post(`${base}/vet-appointments`)
        .set(h)
        .send({ vetName: 'Dr Martin', date: todayStr() })
        .expect(201);
      for (const path of [
        'health-records',
        'vaccinations',
        'measurements',
        'medications',
        'vet-appointments',
        'carnet/export',
      ]) {
        await request(server()).get(`${base}/${path}`).set(h).expect(200);
      }
      await request(server()).get('/users/me/agenda').set(h).expect(200);
    });

    it('actions réservées aux comptes → 403 GUEST_ACCOUNT', async () => {
      const h = bearer(guest.accessToken);
      const expectGuest = (res: request.Response, action: string) => {
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'GUEST_ACCOUNT', action });
      };

      expectGuest(
        await request(server())
          .patch(`/users/me/animals/${animalId}/public-link`)
          .set(h)
          .send({ enabled: true }),
        'public_link',
      );
      expectGuest(
        await request(server())
          .post(`/users/me/animals/${animalId}/public-link/regenerate`)
          .set(h),
        'public_link',
      );
      expectGuest(
        await request(server()).post('/users/me/agenda/calendar-token').set(h),
        'calendar_feed',
      );
      expectGuest(
        await request(server())
          .post('/users/me/subscription')
          .set(h)
          .send({ plan: 'monthly' }),
        'subscription',
      );
      expectGuest(
        await request(server())
          .post('/auth/change-password')
          .set(h)
          .send({
            currentPassword: 'x'.repeat(10),
            newPassword: 'y'.repeat(12),
          }),
        'password',
      );
      expectGuest(
        await request(server()).post('/auth/resend-verification').set(h),
        'email_verification',
      );

      const row = await prisma.animal.findUniqueOrThrow({
        where: { id: animalId },
      });
      expect(row.publicEnabled).toBe(false);
      expect(row.publicSlug).toBeNull();
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: guest.user.id },
      });
      expect(user.calendarToken).toBeNull();
    });

    it('désactiver un lien public reste possible (aucune publication)', async () => {
      await request(server())
        .patch(`/users/me/animals/${animalId}/public-link`)
        .set(bearer(guest.accessToken))
        .send({ enabled: false })
        .expect(200);
    });
  });

  describe('POST /auth/upgrade', () => {
    const PASSWORD = 'GuestUpgrade123!';

    it('exige une session', async () => {
      await request(server())
        .post('/auth/upgrade')
        .send({
          email: emailFor('anon'),
          password: PASSWORD,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(401);
    });

    it('valide comme l’inscription (CGU et âge obligatoires)', async () => {
      const guest = await createGuest();
      await request(server())
        .post('/auth/upgrade')
        .set(bearer(guest.accessToken))
        .send({
          email: emailFor('noterms'),
          password: PASSWORD,
          acceptTerms: false,
          ageConfirmed: true,
        })
        .expect(400);
      await request(server())
        .post('/auth/upgrade')
        .set(bearer(guest.accessToken))
        .send({
          email: emailFor('noage'),
          password: PASSWORD,
          acceptTerms: true,
        })
        .expect(400);
    });

    it('e-mail déjà pris → 409, sans fusion : l’invité reste invité avec ses données', async () => {
      const taken = emailFor('taken');
      await request(server())
        .post('/auth/register')
        .send({
          email: taken,
          password: PASSWORD,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(201);

      const guest = await createGuest();
      await createAnimal(guest.accessToken, 'Orphée').expect(201);
      await request(server())
        .post('/auth/upgrade')
        .set(bearer(guest.accessToken))
        .send({
          email: taken.toUpperCase(),
          password: PASSWORD,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(409);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: guest.user.id },
      });
      expect(row).toMatchObject({ isGuest: true, email: null });
      expect(
        await prisma.animal.count({ where: { userId: guest.user.id } }),
      ).toBe(1);
      const other = await prisma.user.findUniqueOrThrow({
        where: { email: taken },
      });
      expect(await prisma.animal.count({ where: { userId: other.id } })).toBe(
        0,
      );
      // La session invité reste valide.
      await request(server())
        .get('/auth/me')
        .set(bearer(guest.accessToken))
        .expect(200);
    });

    it('convertit le MÊME utilisateur : animaux et carnet conservés, jetons renouvelés, vérification envoyée', async () => {
      const guest = await createGuest();
      const animal = await createAnimal(guest.accessToken, 'Kaa').expect(201);
      const animalId = (animal.body as { id: string }).id;
      await request(server())
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set(bearer(guest.accessToken))
        .send({ name: 'Rage', date: todayStr() })
        .expect(201);
      await request(server())
        .post(`/users/me/animals/${animalId}/measurements`)
        .set(bearer(guest.accessToken))
        .send({ weightKg: 2.34, measuredAt: todayStr() })
        .expect(201);
      sendVerification.mockClear();

      const email = emailFor('upgraded');
      const res = await request(server())
        .post('/auth/upgrade')
        .set(bearer(guest.accessToken))
        .set('User-Agent', 'jest-upgrade')
        .send({
          email: `  ${email.toUpperCase()} `,
          password: PASSWORD,
          acceptTerms: true,
          ageConfirmed: true,
          locale: 'fr',
        })
        .expect(201);
      const upgraded = auth(res);
      expect(upgraded.user).toMatchObject({
        id: guest.user.id,
        email,
        isGuest: false,
        emailVerified: false,
      });
      expect(upgraded.refreshToken).not.toBe(guest.refreshToken);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: guest.user.id },
      });
      expect(row).toMatchObject({
        isGuest: false,
        email,
        locale: 'fr',
        termsVersion: expect.any(String),
      });
      expect(row.passwordHash).toEqual(expect.any(String));
      expect(row.termsAcceptedAt).not.toBeNull();

      // Données conservées et lisibles avec la nouvelle session.
      const list = await request(server())
        .get('/users/me/animals')
        .set(bearer(upgraded.accessToken))
        .expect(200);
      const ids =
        (list.body as { data?: { id: string }[] }).data ??
        (list.body as { id: string }[]);
      expect(ids.map((a) => a.id)).toEqual([animalId]);
      const vacc = await request(server())
        .get(`/users/me/animals/${animalId}/vaccinations`)
        .set(bearer(upgraded.accessToken))
        .expect(200);
      expect(JSON.stringify(vacc.body)).toContain('Rage');
      expect(
        await prisma.animalMeasurement.count({ where: { animalId } }),
      ).toBe(1);

      // Anciens jetons invalidés.
      await request(server())
        .get('/auth/me')
        .set(bearer(guest.accessToken))
        .expect(401);
      await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: guest.refreshToken })
        .expect(401);

      // Connexion par e-mail + mot de passe désormais possible.
      await request(server())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);

      // E-mail de vérification envoyé à la nouvelle adresse.
      await new Promise((r) => setTimeout(r, 200));
      expect(sendVerification).toHaveBeenCalledWith(
        email,
        'fr',
        expect.stringContaining('/verifier-email?token='),
      );

      // Plus un invité : le lien public relève désormais du Premium (pas de GUEST_ACCOUNT).
      const pub = await request(server())
        .patch(`/users/me/animals/${animalId}/public-link`)
        .set(bearer(upgraded.accessToken))
        .send({ enabled: true })
        .expect(403);
      expect((pub.body as { code?: string }).code).toBeUndefined();

      // Deuxième conversion refusée.
      const again = await request(server())
        .post('/auth/upgrade')
        .set(bearer(upgraded.accessToken))
        .send({
          email: emailFor('again'),
          password: PASSWORD,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(403);
      expect(again.body).toMatchObject({ code: 'NOT_A_GUEST' });

      // Compte gratuit : toujours 1 animal (le 2e exige Premium).
      const second = await createAnimal(upgraded.accessToken, 'Nagini').expect(
        403,
      );
      expect(second.body).toMatchObject({ code: 'ANIMAL_LIMIT' });
    });

    it('un invité peut supprimer son compte sans mot de passe ; un compte, non', async () => {
      const guest = await createGuest();
      await createAnimal(guest.accessToken, 'Temp').expect(201);
      await request(server())
        .delete('/users/me')
        .set(bearer(guest.accessToken))
        .send({})
        .expect(204);
      expect(
        await prisma.user.findUnique({ where: { id: guest.user.id } }),
      ).toBeNull();

      const email = emailFor('delete-nopwd');
      const reg = await request(server())
        .post('/auth/register')
        .send({
          email,
          password: PASSWORD,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(201);
      await request(server())
        .delete('/users/me')
        .set(bearer(auth(reg).accessToken))
        .send({})
        .expect(401);
    });
  });

  describe('Purge des invités inactifs', () => {
    it('supprime en cascade les invités inactifs depuis plus de 90 jours, et eux seuls', async () => {
      const purge = app.get(GuestPurgeService);
      const now = new Date();
      const old = new Date(now.getTime() - 91 * DAY_MS);
      const recent = new Date(now.getTime() - 89 * DAY_MS);

      const stale = await createGuest();
      const staleAnimal = await createAnimal(stale.accessToken, 'Stale').expect(
        201,
      );
      const staleAnimalId = (staleAnimal.body as { id: string }).id;
      await request(server())
        .post(`/users/me/animals/${staleAnimalId}/vaccinations`)
        .set(bearer(stale.accessToken))
        .send({ name: 'Rage', date: todayStr() })
        .expect(201);
      const fresh = await createGuest();
      const subscribed = await createGuest();
      await prisma.subscription.create({
        data: {
          userId: subscribed.user.id,
          source: 'MANUAL',
          productId: 'test',
          status: 'EXPIRED',
          originalTransactionId: `guest-purge-${tag}`,
        },
      });
      const account = await prisma.user.create({
        data: {
          email: emailFor('old-account'),
          passwordHash: 'x',
          lastActiveAt: old,
        },
      });

      await prisma.user.updateMany({
        where: { id: { in: [stale.user.id, subscribed.user.id] } },
        data: { lastActiveAt: old },
      });
      await prisma.user.update({
        where: { id: fresh.user.id },
        data: { lastActiveAt: recent },
      });

      const res = await purge.runOnce(now, 90);
      expect(res.locked).toBe(true);
      expect(res.deleted).toBeGreaterThanOrEqual(1);

      expect(
        await prisma.user.findUnique({ where: { id: stale.user.id } }),
      ).toBeNull();
      expect(
        await prisma.animal.findUnique({ where: { id: staleAnimalId } }),
      ).toBeNull();
      expect(
        await prisma.vaccination.count({ where: { animalId: staleAnimalId } }),
      ).toBe(0);
      expect(
        await prisma.refreshToken.count({ where: { userId: stale.user.id } }),
      ).toBe(0);
      expect(
        await prisma.user.findUnique({ where: { id: fresh.user.id } }),
      ).not.toBeNull();
      expect(
        await prisma.user.findUnique({ where: { id: subscribed.user.id } }),
      ).not.toBeNull();
      expect(
        await prisma.user.findUnique({ where: { id: account.id } }),
      ).not.toBeNull();

      // Durée paramétrable (GUEST_RETENTION_DAYS) : 30 jours → l'invité de 89 jours part aussi.
      await purge.runOnce(now, 30);
      expect(
        await prisma.user.findUnique({ where: { id: fresh.user.id } }),
      ).toBeNull();
    });

    it('une requête authentifiée rafraîchit lastActiveAt (au plus une écriture par heure)', async () => {
      const guest = await createGuest();
      const old = new Date(Date.now() - 10 * DAY_MS);
      await prisma.user.update({
        where: { id: guest.user.id },
        data: { lastActiveAt: old },
      });
      await request(server())
        .get('/auth/me')
        .set(bearer(guest.accessToken))
        .expect(200);
      await new Promise((r) => setTimeout(r, 200));
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: guest.user.id },
      });
      expect(Date.now() - row.lastActiveAt.getTime()).toBeLessThan(60_000);
    });
  });

  describe('Limitation de création par IP', () => {
    let throttledApp: INestApplication;

    beforeAll(async () => {
      throttledApp = await buildApp(true);
    });
    afterAll(async () => {
      if (throttledApp) await throttledApp.close();
    });

    it(`au-delà de ${GUEST_CREATION_LIMIT} invités par heure et par IP → 429`, async () => {
      const srv = throttledApp.getHttpServer() as App;
      for (let i = 0; i < GUEST_CREATION_LIMIT; i++) {
        const res = await request(srv).post('/auth/guest').send({}).expect(201);
        guestIds.push(auth(res).user.id);
      }
      const denied = await request(srv)
        .post('/auth/guest')
        .send({})
        .expect(429);
      expect(denied.headers['retry-after']).toEqual(expect.any(String));
    });
  });
});
