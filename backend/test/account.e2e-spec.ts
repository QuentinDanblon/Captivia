import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

const PASSWORD = 'AccountTest123!';
const SPECIES_ID = 5221172;

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
// (supertest renvoie des corps `any` ; fichier de test.)

function makeEmail(tag: string): string {
  return `account-${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@captivia.local`;
}

describe('Account E2E — suppression et export RGPD', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  async function registerUser(tag: string) {
    const email = makeEmail(tag);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: PASSWORD,
        locale: 'fr',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    createdEmails.push(email);
    return {
      email,
      token: res.body.accessToken as string,
      userId: res.body.user.id as string,
    };
  }

  /** Crée un animal (API) + routine (API) + sous-entités (Prisma) + données notif. */
  async function seedUserData(token: string, userId: string) {
    const animal = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesId: SPECIES_ID, name: 'Export Gecko', sex: 'male' })
      .expect(201);
    const animalId = animal.body.id as string;

    await request(app.getHttpServer())
      .post(`/users/me/animals/${animalId}/routines`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '08:00', recurrence: 'daily' },
      })
      .expect(201);

    await prisma.animalHealthRecord.create({
      data: {
        animalId,
        type: 'surgery',
        title: 'Stérilisation',
        date: new Date(),
      },
    });
    await prisma.vaccination.create({
      data: { animalId, name: 'Rage', date: new Date() },
    });
    await prisma.animalMeasurement.create({
      data: { animalId, weightKg: 0.12, measuredAt: new Date() },
    });
    await prisma.actionLog.create({ data: { animalId, type: 'feed' } });
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: `https://push.example.com/${userId}`,
        keys: { p256dh: 'SECRET-P256DH', auth: 'SECRET-AUTH' },
      },
    });
    await prisma.notificationPreference.create({
      data: {
        userId,
        types: { Nourrissage: true },
        schedule: { start: '08:00', end: '22:00' },
      },
    });
    await prisma.notificationEvent.create({
      data: { userId, animalId, type: 'Nourrissage', scheduledAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: `reset-token-hash-${userId}`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    return animalId;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  describe('DELETE /users/me', () => {
    it('sans token → 401', async () => {
      await request(app.getHttpServer())
        .delete('/users/me')
        .send({ password: PASSWORD })
        .expect(401);
    });

    it('mauvais mot de passe → 401 et le compte existe toujours', async () => {
      const acc = await registerUser('wrongpw');
      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${acc.token}`)
        .send({ password: 'not-the-password' })
        .expect(401);
      expect(
        await prisma.user.findUnique({ where: { id: acc.userId } }),
      ).not.toBeNull();
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${acc.token}`)
        .expect(200);
    });

    it('mot de passe absent → 401 (facultatif seulement pour un invité)', async () => {
      const acc = await registerUser('nopw');
      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${acc.token}`)
        .send({})
        .expect(401);
    });

    it('suppression OK → 204, JWT invalide (401) et plus aucune ligne liée', async () => {
      const acc = await registerUser('delete');
      const animalId = await seedUserData(acc.token, acc.userId);

      expect(await prisma.animal.count({ where: { userId: acc.userId } })).toBe(
        1,
      );
      expect(await prisma.routine.count({ where: { animalId } })).toBe(1);

      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${acc.token}`)
        .send({ password: PASSWORD })
        .expect(204);

      // Le JWT (encore non expiré) n'est plus utilisable : l'utilisateur n'existe plus.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${acc.token}`)
        .expect(401);

      // Plus aucune ligne liée en base.
      const byAnimal = { where: { animalId } };
      const byUser = { where: { userId: acc.userId } };
      expect(await prisma.user.count({ where: { id: acc.userId } })).toBe(0);
      expect(await prisma.animal.count(byUser)).toBe(0);
      expect(await prisma.routine.count(byAnimal)).toBe(0);
      expect(await prisma.animalHealthRecord.count(byAnimal)).toBe(0);
      expect(await prisma.vaccination.count(byAnimal)).toBe(0);
      expect(await prisma.animalMeasurement.count(byAnimal)).toBe(0);
      expect(await prisma.actionLog.count(byAnimal)).toBe(0);
      expect(await prisma.pushSubscription.count(byUser)).toBe(0);
      expect(await prisma.notificationPreference.count(byUser)).toBe(0);
      expect(await prisma.notificationEvent.count(byUser)).toBe(0);
      expect(await prisma.passwordResetToken.count(byUser)).toBe(0);

      // Le login n'est plus possible non plus.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: acc.email, password: PASSWORD })
        .expect(401);
    });

    it("un utilisateur ne peut supprimer que son propre compte (le compte d'un autre est intact)", async () => {
      const a = await registerUser('own-a');
      const b = await registerUser('own-b');
      const animalB = await seedUserData(b.token, b.userId);

      // A supprime son compte avec son token : B n'est pas touché.
      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ password: PASSWORD })
        .expect(204);

      expect(
        await prisma.user.findUnique({ where: { id: b.userId } }),
      ).not.toBeNull();
      expect(
        await prisma.animal.findUnique({ where: { id: animalB } }),
      ).not.toBeNull();
    });
  });

  describe('GET /users/me/export', () => {
    it('sans token → 401', async () => {
      await request(app.getHttpServer()).get('/users/me/export').expect(401);
    });

    it('contient toutes les données, sans passwordHash ni tokens, en pièce jointe', async () => {
      const acc = await registerUser('export');
      const animalId = await seedUserData(acc.token, acc.userId);

      const res = await request(app.getHttpServer())
        .get('/users/me/export')
        .set('Authorization', `Bearer ${acc.token}`)
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="captivia-export-\d{4}-\d{2}-\d{2}\.json"$/,
      );

      const body = res.body;
      expect(body.profile.email).toBe(acc.email);
      expect(body.profile.id).toBe(acc.userId);
      expect(body.profile.role).toBe('USER');
      expect(body.profile.termsAcceptedAt).toEqual(expect.any(String));
      expect(body.profile.termsVersion).toEqual(expect.any(String));
      expect(body.gamification).toEqual({ points: 0, grade: 'bronze' });

      expect(body.animals).toHaveLength(1);
      const animal = body.animals[0];
      expect(animal.id).toBe(animalId);
      expect(animal.name).toBe('Export Gecko');
      expect(animal.routines).toHaveLength(1);
      expect(animal.healthRecords).toHaveLength(1);
      expect(animal.vaccinations).toHaveLength(1);
      expect(animal.measurements).toHaveLength(1);
      expect(animal.actionLogs).toHaveLength(1);
      expect(animal.medications).toEqual([]);
      expect(animal.vetAppointments).toEqual([]);
      expect(animal.breedingRecords).toEqual([]);

      expect(body.notificationPreferences[0].types).toEqual({
        Nourrissage: true,
      });
      expect(body.notificationEvents).toHaveLength(1);
      expect(body.pushSubscriptions).toHaveLength(1);

      // Revue de sécurité, constat 10 : export complété (format v2).
      expect(body.exportVersion).toBe(3);
      expect(body.profile).toHaveProperty('emailVerifiedAt', null);
      expect(body.profile.timezone).toBe('Europe/Paris');
      expect(body.pushSubscriptionsActive).toBe(1);
      expect(body.calendarFeed).toEqual({ enabled: false });
      // Sessions : métadonnées seulement (inscription = 1 session), jamais l'empreinte du jeton.
      expect(body.sessions.length).toBeGreaterThanOrEqual(1);
      for (const s of body.sessions) {
        expect(Object.keys(s).sort()).toEqual([
          'createdAt',
          'expiresAt',
          'revokedAt',
          'userAgent',
        ]);
      }
      const hashes = await prisma.refreshToken.findMany({
        where: { userId: acc.userId },
        select: { tokenHash: true },
      });
      expect(hashes.length).toBeGreaterThanOrEqual(1);

      // Aucun secret dans l'export.
      const raw = JSON.stringify(body);
      expect(raw).not.toContain('passwordHash');
      expect(raw).not.toContain('tokenHash');
      expect(raw).not.toContain('calendarToken');
      for (const { tokenHash } of hashes) expect(raw).not.toContain(tokenHash);
      expect(raw).not.toContain('SECRET-P256DH');
      expect(raw).not.toContain('SECRET-AUTH');
      expect(raw).not.toContain('reset-token-');

      // Flux calendrier activé : l'export l'indique, sans jamais contenir le jeton (ni son hash).
      const gen = await request(app.getHttpServer())
        .post('/users/me/agenda/calendar-token')
        .set('Authorization', `Bearer ${acc.token}`)
        .expect(201);
      const again = await request(app.getHttpServer())
        .get('/users/me/export')
        .set('Authorization', `Bearer ${acc.token}`)
        .expect(200);
      expect(again.body.calendarFeed).toEqual({ enabled: true });
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: acc.userId },
        select: { calendarToken: true },
      });
      const raw2 = JSON.stringify(again.body);
      expect(raw2).not.toContain(gen.body.token as string);
      expect(raw2).not.toContain(stored.calendarToken as string);
    });

    it("n'exporte que les données de l'utilisateur authentifié", async () => {
      const a = await registerUser('exp-a');
      const b = await registerUser('exp-b');
      await seedUserData(a.token, a.userId);

      const res = await request(app.getHttpServer())
        .get('/users/me/export')
        .set('Authorization', `Bearer ${b.token}`)
        .expect(200);

      expect(res.body.profile.id).toBe(b.userId);
      expect(res.body.animals).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain(a.email);
    });

    it('export gratuit pour un compte non premium (pas de 402/403)', async () => {
      const acc = await registerUser('free');
      const user = await prisma.user.findUnique({ where: { id: acc.userId } });
      expect(user?.isPremium).toBe(false);
      await request(app.getHttpServer())
        .get('/users/me/export')
        .set('Authorization', `Bearer ${acc.token}`)
        .expect(200);
    });
  });
});
