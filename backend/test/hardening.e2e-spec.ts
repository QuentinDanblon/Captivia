import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Boot NestJS + Prisma peut prendre du temps sur Windows
jest.setTimeout(60000);

const PASSWORD = 'Hardening123!';

/** Email jetable unique (jamais opérateur : rôle USER par défaut). */
function makeEmail(tag: string): string {
  return `hardening-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@captivia.local`;
}

/** Champs de consentement désormais obligatoires à l'inscription (W2-03). */
const TERMS = { acceptTerms: true, ageConfirmed: true };

describe('Hardening E2E — verrouillage des corrections sécurité/fonctionnelles', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  /** Crée un compte jetable et retourne son token + id. */
  async function registerUser(email: string): Promise<{ email: string; token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD, locale: 'fr', ...TERMS })
      .expect(201);
    createdEmails.push(email);
    return {
      email,
      token: res.body.accessToken as string,
      userId: res.body.user.id as string,
    };
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
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Nettoyage : suppression des comptes jetables (cascade animaux, routines,
    // events, préférences, tokens de reset).
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  // ============================================================
  // 1. Paywall — abonnement désactivé + activation premium réservée aux opérateurs
  // ============================================================
  describe('1. Paywall', () => {
    let token: string;
    let userId: string;

    it('POST /users/me/subscription → 501 (paiement en ligne désactivé)', async () => {
      const acc = await registerUser(makeEmail('paywall'));
      token = acc.token;
      userId = acc.userId;

      await request(app.getHttpServer())
        .post('/users/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'monthly' })
        .expect(501);
    });

    it('POST /admin/users/:id/premium sans token → 401', () => {
      return request(app.getHttpServer())
        .post(`/admin/users/${crypto.randomUUID()}/premium`)
        .send({})
        .expect(401);
    });

    it('POST /admin/users/:id/premium avec token non-opérateur → 403', () => {
      // Le compte jetable a le rôle USER (défaut) → 403
      return request(app.getHttpServer())
        .post(`/admin/users/${userId}/premium`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);
    });
  });

  // ============================================================
  // 2. Codes HTTP — login et forgot-password en 200 (plus 201)
  // ============================================================
  describe('2. Codes HTTP', () => {
    let token: string;

    it('POST /auth/login → 200 (plus 201)', async () => {
      const acc = await registerUser(makeEmail('login'));
      token = acc.token;

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: acc.email, password: PASSWORD })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
    });

    it('POST /auth/forgot-password → 200', () => {
      // Email inconnu : réponse 200 générique (anti-énumération), aucun email envoyé
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: makeEmail('forgot') })
        .expect(200);
    });
  });

  // ============================================================
  // 3. RBAC — écritures /equipment réservées aux opérateurs
  // ============================================================
  describe('3. RBAC equipment', () => {
    let token: string;

    it('POST /equipment avec compte non-opérateur → 403', async () => {
      const acc = await registerUser(makeEmail('rbac'));
      token = acc.token;

      await request(app.getHttpServer())
        .post('/equipment')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'chauffage', label: 'Test', searchTerms: ['test'] })
        .expect(403);
    });

    it('DELETE /equipment/{uuid inexistant} non-opérateur → 403 (pas 404)', async () => {
      await request(app.getHttpServer())
        .delete(`/equipment/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ============================================================
  // 4. DTOs — validation animaux (speciesId, name, birthDate)
  // ============================================================
  describe('4. DTOs animaux', () => {
    let token: string;

    it('POST /users/me/animals speciesId:0 → 400', async () => {
      const acc = await registerUser(makeEmail('dto'));
      token = acc.token;

      await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId: 0, name: 'Zero' })
        .expect(400);
    });

    it('POST /users/me/animals name:"   " → 400 (trim puis MinLength)', () => {
      return request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId: 5221172, name: '   ' })
        .expect(400);
    });

    it('POST /users/me/animals birthDate:"2026-13-45" → 400 (date impossible)', () => {
      return request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId: 5221172, name: 'Bad Date', birthDate: '2026-13-45' })
        .expect(400);
    });

    it('POST /users/me/animals valide (speciesId 5221172 seed) → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speciesId: 5221172,
          name: 'Gecko Test',
          sex: 'male',
          birthDate: '2026-01-15',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('speciesId', 5221172);
      expect(res.body).toHaveProperty('name', 'Gecko Test');
    });
  });

  // ============================================================
  // 5. Pipeline events — routine daily → event sans préférences → points
  // ============================================================
  describe('5. Pipeline events', () => {
    let token: string;
    let userId: string;
    let animalId: string;
    let eventId: string;

    it('nouveau compte + animal + routine daily → routine créée', async () => {
      const acc = await registerUser(makeEmail('pipeline'));
      token = acc.token;
      userId = acc.userId;

      const animal = await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId: 5221172, name: 'Pipeline Gecko', sex: 'male' })
        .expect(201);
      animalId = animal.body.id;

      const routine = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'nourrissage',
          frequency: 'daily',
          schedule: { time: '08:00', recurrence: 'daily' },
        })
        .expect(201);

      expect(routine.body).toHaveProperty('id');
    });

    it('GET /users/me/notification-events?date=today → ≥1 event SANS préférences', async () => {
      // Compte vierge : aucune NotificationPreference en base
      const prefs = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
      expect(prefs).toBeNull();

      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app.getHttpServer())
        .get(`/users/me/notification-events?date=${today}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('status', 'pending');
      expect(res.body[0]).toHaveProperty('routineId');
      eventId = res.body[0].id;
    });

    it('PATCH event done → grade.points >= 2', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/notification-events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'done' })
        .expect(200);

      expect(res.body.event).toHaveProperty('status', 'done');
      expect(res.body.grade).toHaveProperty('points');
      expect(res.body.grade.points).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // 6. Gateway — query requise + clear-cache authentifié
  // ============================================================
  describe('6. Gateway', () => {
    it('GET /gateway/enriched sans query → 400', () => {
      return request(app.getHttpServer())
        .get('/gateway/enriched')
        .expect(400);
    });

    it('POST /gateway/clear-cache/5212 sans token → 401', () => {
      return request(app.getHttpServer())
        .post('/gateway/clear-cache/5212')
        .expect(401);
    });
  });

  // ============================================================
  // 7. Rate limit auth — DERNIER (laisse le limiter IP épuisé ~60s)
  // ============================================================
  describe('7. Rate limit auth (10/60s par IP)', () => {
    it('12 POST /auth/login rapides → au moins une 429', async () => {
      // Email inconnu : réponses 401 tant que le budget n'est pas épuisé,
      // puis 429 (AuthRateLimitGuard, 10/60s, IP fixe en test supertest).
      const email = `ratelimit-${Date.now()}@captivia.local`;
      const statuses: number[] = [];

      for (let i = 0; i < 12; i++) {
        const res = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password: 'WrongPass123!' });
        statuses.push(res.status);
      }

      // Toutes les réponses doivent être 401 (creds invalides) ou 429 (throttlé)
      for (const status of statuses) {
        expect([401, 429]).toContain(status);
      }
      expect(statuses).toContain(429);
    });
  });
});
