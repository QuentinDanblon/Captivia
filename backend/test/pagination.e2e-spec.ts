import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthBody, bodyOf, httpServer } from './utils/http';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

const PASSWORD = 'PaginationTest123!';
const SPECIES_ID = 5221172;

describe('Pagination et tri stable E2E (W1-05)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let animalId: string;
  const email = `pagination-${Date.now()}-${Math.floor(Math.random() * 100000)}@captivia.local`;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const ids = (body: unknown) =>
    (body as Array<{ id: string }>).map((x) => x.id);

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

    const res = await request(httpServer(app))
      .post('/auth/register')
      .send({
        email,
        password: PASSWORD,
        locale: 'fr',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    token = bodyOf<AuthBody>(res).accessToken;
    userId = bodyOf<AuthBody>(res).user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: true },
    });

    // Plusieurs animaux créés dans la même milliseconde (createdAt identiques) :
    // l'ordre doit rester déterministe grâce au tie-breaker `id`.
    const createdAt = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < 4; i++) {
      await prisma.animal.create({
        data: { userId, speciesId: SPECIES_ID, name: `Pag ${i}`, createdAt },
      });
    }
    const animal = await prisma.animal.findFirst({ where: { userId } });
    animalId = animal!.id;

    const date = new Date('2026-02-01T00:00:00Z');
    for (let i = 0; i < 4; i++) {
      await prisma.vaccination.create({
        data: { animalId, name: `Vacc ${i}`, date },
      });
    }
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (app) await app.close();
  });

  describe('GET /users/me/animals', () => {
    it('sans paramètre : tableau complet (comportement inchangé)', async () => {
      const res = await request(httpServer(app))
        .get('/users/me/animals')
        .set(auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(4);
    });

    it('limit=101 → 400', async () => {
      await request(httpServer(app))
        .get('/users/me/animals?limit=101')
        .set(auth())
        .expect(400);
    });

    it('limit=0, limit=abc, offset=-1 → 400', async () => {
      for (const q of ['limit=0', 'limit=abc', 'offset=-1']) {
        await request(httpServer(app))
          .get(`/users/me/animals?${q}`)
          .set(auth())
          .expect(400);
      }
    });

    it('limit=2 → 2 éléments, et offset=2 → les suivants sans doublon', async () => {
      const first = await request(httpServer(app))
        .get('/users/me/animals?limit=2')
        .set(auth())
        .expect(200);
      expect(first.body).toHaveLength(2);

      const second = await request(httpServer(app))
        .get('/users/me/animals?limit=2&offset=2')
        .set(auth())
        .expect(200);
      expect(second.body).toHaveLength(2);

      const all = await request(httpServer(app))
        .get('/users/me/animals')
        .set(auth())
        .expect(200);
      expect([...ids(first.body), ...ids(second.body)]).toEqual(ids(all.body));
    });

    it('ordre stable entre deux appels (createdAt identiques)', async () => {
      const a = await request(httpServer(app))
        .get('/users/me/animals')
        .set(auth())
        .expect(200);
      const b = await request(httpServer(app))
        .get('/users/me/animals')
        .set(auth())
        .expect(200);
      expect(ids(a.body)).toEqual(ids(b.body));
      expect(ids(a.body)).toEqual([...ids(a.body)].sort());
    });
  });

  describe('GET /users/me/animals/:id/vaccinations', () => {
    const url = () => `/users/me/animals/${animalId}/vaccinations`;

    it('sans paramètre : tableau complet', async () => {
      const res = await request(httpServer(app))
        .get(url())
        .set(auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(4);
    });

    it('limit=101 → 400', async () => {
      await request(httpServer(app))
        .get(`${url()}?limit=101`)
        .set(auth())
        .expect(400);
    });

    it('limit=2 → 2 éléments ; ordre stable entre deux appels', async () => {
      const a = await request(httpServer(app))
        .get(`${url()}?limit=2`)
        .set(auth())
        .expect(200);
      const b = await request(httpServer(app))
        .get(`${url()}?limit=2`)
        .set(auth())
        .expect(200);
      expect(a.body).toHaveLength(2);
      expect(ids(a.body)).toEqual(ids(b.body));
    });
  });

  describe('GET /species/search/advanced (DTO validé)', () => {
    it('limit=101 → 400', async () => {
      await request(httpServer(app))
        .get('/species/search/advanced?query=chat&limit=101')
        .expect(400);
    });

    it('paramètre inconnu → 400', async () => {
      await request(httpServer(app))
        .get('/species/search/advanced?query=chat&evil=1')
        .expect(400);
    });
  });
});
