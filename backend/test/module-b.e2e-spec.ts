import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Boot NestJS + Prisma peut prendre du temps sur Windows
jest.setTimeout(60000);

const PASSWORD = 'ModuleB123!';

/** Email jetable unique. */
function makeEmail(tag: string): string {
  return `module-b-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@captivia.local`;
}

/** Date UTC du jour en YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Date UTC décalée de N jours en YYYY-MM-DD. */
function dayOffsetStr(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('Module B E2E — suivi reproduction & fiche espèce', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdEmails: string[] = [];
  const createdReproductionIds: string[] = [];

  /**
   * Crée un compte jetable directement en base (isPremium selon le besoin) et
   * signe un JWT valide ({ sub, email } — le guard recharge l'utilisateur depuis
   * la DB à chaque requête).
   */
  async function createUser(
    email: string,
    isPremium: boolean,
  ): Promise<{ email: string; token: string; userId: string }> {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, locale: 'fr', isPremium },
    });
    createdEmails.push(email);
    const token = jwtService.sign({ sub: user.id, email: user.email });
    return { email, token, userId: user.id };
  }

  /** Crée un compte jetable PREMIUM et retourne token + userId. */
  function registerPremium(email: string): Promise<{ email: string; token: string; userId: string }> {
    return createUser(email, true);
  }

  /** Crée un animal pour le compte et retourne son id. */
  async function createAnimal(token: string, name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesId: 5221172, name, sex: 'female' })
      .expect(201);
    return res.body.id as string;
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
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    // Nettoyage : fiches reproduction de test (table laissée vide) puis comptes
    // jetables (cascade animaux + breeding records).
    if (prisma && createdReproductionIds.length > 0) {
      await prisma.speciesReproduction.deleteMany({
        where: { id: { in: createdReproductionIds } },
      });
    }
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  // ============================================================
  // 1. CRUD breeding records (Premium)
  // ============================================================
  describe('1. CRUD breeding records', () => {
    let token: string;
    let animalId: string;
    let recordId: string;

    it('POST → 201 (heat complet, partnerName trimé)', async () => {
      const acc = await registerPremium(makeEmail('crud'));
      token = acc.token;
      animalId = await createAnimal(token, 'Breeding Gecko');

      const res = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventType: 'heat',
          date: todayStr(),
          partnerName: '  Romeo  ',
          notes: 'premier cycle',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('eventType', 'heat');
      expect(res.body).toHaveProperty('partnerName', 'Romeo');
      expect(res.body).toHaveProperty('offspringCount', null);
      recordId = res.body.id;
    });

    it('POST birth avec offspringCount → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventType: 'birth',
          date: dayOffsetStr(-30),
          offspringCount: 4,
          notes: 'portée saine',
        })
        .expect(201);
      expect(res.body).toHaveProperty('eventType', 'birth');
      expect(res.body).toHaveProperty('offspringCount', 4);
    });

    it('GET → 200, tri par date desc', async () => {
      // Un événement plus ancien que le birth (-30j) : le heat (aujourd'hui)
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'mating', date: dayOffsetStr(-40) })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      const dates = res.body.map((r: { date: string }) => new Date(r.date).getTime());
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('PATCH → 200 (eventType + offspringCount)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'pregnancy', partnerName: 'Juliette' })
        .expect(200);

      expect(res.body).toHaveProperty('eventType', 'pregnancy');
      expect(res.body).toHaveProperty('partnerName', 'Juliette');
    });

    it('PATCH date invalide → 400', () => {
      return request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-13-45' })
        .expect(400);
    });

    it('DELETE → 200 puis GET → disparu', async () => {
      await request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.some((r: { id: string }) => r.id === recordId)).toBe(false);
    });

    it('DELETE id inexistant → 404', () => {
      return request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/breeding/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ============================================================
  // 2. Validation DTOs (400)
  // ============================================================
  describe('2. Validation DTOs', () => {
    let token: string;
    let animalId: string;

    it('POST eventType invalide → 400', async () => {
      const acc = await registerPremium(makeEmail('dto'));
      token = acc.token;
      animalId = await createAnimal(token, 'Dto Gecko');

      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'divorce', date: todayStr() })
        .expect(400);
    });

    it('POST eventType manquant → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: todayStr() })
        .expect(400);
    });

    it('POST date impossible → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'heat', date: '2026-02-30' })
        .expect(400);
    });

    it('POST birth sans offspringCount → 400 (check service)', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'birth', date: todayStr() })
        .expect(400);
    });

    it('POST offspringCount négatif → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'birth', date: todayStr(), offspringCount: -1 })
        .expect(400);
    });

    it('POST offspringCount > 100 → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'birth', date: todayStr(), offspringCount: 101 })
        .expect(400);
    });

    it('POST partnerName > 100 chars → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'heat', date: todayStr(), partnerName: 'x'.repeat(101) })
        .expect(400);
    });

    it('POST notes > 1000 chars → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'heat', date: todayStr(), notes: 'x'.repeat(1001) })
        .expect(400);
    });

    it('PATCH vers birth sans offspringCount → 400', async () => {
      // Enregistrement sans offspringCount (mating), puis PATCH eventType=birth
      const rec = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'mating', date: todayStr() })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/breeding/${rec.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'birth' })
        .expect(400);
    });

    it('PATCH birth avec offspringCount 0 → 200 (borne basse acceptée)', async () => {
      const rec = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'pregnancy', date: todayStr() })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/breeding/${rec.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'birth', offspringCount: 0 })
        .expect(200);
      expect(res.body).toHaveProperty('offspringCount', 0);
    });
  });

  // ============================================================
  // 3. Guards — premium requis + ownership (BOLA)
  // ============================================================
  describe('3. Guards premium & ownership', () => {
    let premiumToken: string;
    let animalId: string;
    let recordId: string;

    it('compte non-premium → 403 sur breeding', async () => {
      const acc = await registerPremium(makeEmail('guard-owner'));
      premiumToken = acc.token;
      animalId = await createAnimal(premiumToken, 'Guard Gecko');

      // Un record existe (pour tester le BOLA ensuite)
      const rec = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ eventType: 'heat', date: todayStr() })
        .expect(201);
      recordId = rec.body.id;

      const free = await createUser(makeEmail('guard-free'), false);

      await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${free.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${free.token}`)
        .send({ eventType: 'heat', date: todayStr() })
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${free.token}`)
        .send({ eventType: 'mating' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${free.token}`)
        .expect(403);
    });

    it('sans token → 401', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/breeding`)
        .expect(401);
    });

    it('animal d’autrui (autre compte premium) → 403', async () => {
      const other = await registerPremium(makeEmail('guard-other'));
      await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/breeding`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ eventType: 'heat', date: todayStr() })
        .expect(403);
    });

    it('BOLA : record d’un animal d’autrui → 403 (PATCH/DELETE)', async () => {
      const other = await registerPremium(makeEmail('guard-bola'));
      await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ eventType: 'mating' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/breeding/${recordId}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
    });

    it('animal inexistant → 404', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${crypto.randomUUID()}/breeding`)
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(404);
    });
  });

  // ============================================================
  // 4. Fiche reproduction par espèce (public, RateLimitGuard)
  // ============================================================
  describe('4. Species reproduction factsheet', () => {
    const SPECIES_WITH_FR = 99001001;
    const SPECIES_WITH_FALLBACK = 99001002;

    it('GET espèces sans fiche → 404 propre (message clair)', async () => {
      const res = await request(app.getHttpServer())
        .get('/species/5221172/reproduction')
        .expect(404);
      expect(res.body.message).toContain('Reproduction data not available');
    });

    it('GET fiche fr → 200 avec les champs éditoriaux', async () => {
      const row = await prisma.speciesReproduction.create({
        data: {
          speciesId: SPECIES_WITH_FR,
          locale: 'fr',
          season: 'printemps',
          gestationDays: 30,
          litterSizeMin: 2,
          litterSizeMax: 6,
          sexualMaturityMonths: 12,
          breedingDifficulty: 'modere',
          notes: 'fiche de test module-b',
        },
      });
      createdReproductionIds.push(row.id);

      const res = await request(app.getHttpServer())
        .get(`/species/${SPECIES_WITH_FR}/reproduction`)
        .expect(200);

      expect(res.body).toHaveProperty('speciesId', SPECIES_WITH_FR);
      expect(res.body).toHaveProperty('locale', 'fr');
      expect(res.body).toHaveProperty('season', 'printemps');
      expect(res.body).toHaveProperty('gestationDays', 30);
      expect(res.body).toHaveProperty('breedingDifficulty', 'modere');
    });

    it('GET sans fiche fr → fallback sur une autre locale', async () => {
      const row = await prisma.speciesReproduction.create({
        data: {
          speciesId: SPECIES_WITH_FALLBACK,
          locale: 'en',
          season: 'spring',
          gestationDays: 45,
        },
      });
      createdReproductionIds.push(row.id);

      const res = await request(app.getHttpServer())
        .get(`/species/${SPECIES_WITH_FALLBACK}/reproduction`)
        .expect(200);

      expect(res.body).toHaveProperty('locale', 'en');
      expect(res.body).toHaveProperty('season', 'spring');
    });

    it('GET id non numérique → 404 propre', () => {
      return request(app.getHttpServer())
        .get('/species/abc/reproduction')
        .expect((res) => {
          // 400 = rejet par le DTO GetSpeciesDto (id doit être numérique),
          // 404 = message propre — jamais 500.
          expect([400, 404]).toContain(res.status);
        });
    });
  });
});
