import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import * as request from 'supertest';
import { AuthBody, IdBody, bodyOf, httpServer } from './utils/http';
import { PrismaService } from '../src/prisma/prisma.service';
import { routineTypes } from '../src/routines/dto/routine.dto';

describe('API E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let animalId: string;

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
    // Cleanup test data
    if (userId) {
      await prisma.animal.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (app) await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET)', () => {
      return request(httpServer(app))
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Species Search', () => {
    it('/species/search with valid query', () => {
      return request(httpServer(app))
        .get('/species/search?q=boa&limit=20')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('source');
        });
    });

    it('/species/search with empty query should return 400', () => {
      return request(httpServer(app)).get('/species/search').expect(400);
    });

    it('/species/search with negative limit should return 400', () => {
      return request(httpServer(app))
        .get('/species/search?q=test&limit=-1')
        .expect(400);
    });

    it('/species/search with negative offset should return 400', () => {
      return request(httpServer(app))
        .get('/species/search?q=test&offset=-1')
        .expect(400);
    });
  });

  describe('Species Details', () => {
    it('/species/:id should return species details', () => {
      return request(httpServer(app))
        .get('/species/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('key');
          expect(res.body).toHaveProperty('canonicalName');
          expect(res.body).toHaveProperty('name');
        });
    });

    it('/species/:id with invalid ID should return 404', () => {
      return request(httpServer(app)).get('/species/999999').expect(404);
    });
  });

  describe('Rate Limiting', () => {
    it('/species/search should return 200 or 429 under load', async () => {
      const agent = request.agent(httpServer(app));
      for (let i = 0; i < 6; i++) {
        const res = await agent.get('/species/search?q=test');
        expect([200, 429]).toContain(res.status);
      }
    });
  });

  describe('Error Handling', () => {
    it('/species/:id with non-numeric id should return 400 (DTO validation)', () => {
      return request(httpServer(app)).get('/species/invalid-path').expect(400);
    });

    it('/invalid-endpoint should return 404', () => {
      return request(httpServer(app)).get('/invalid').expect(404);
    });
  });

  describe('Authentication Flow', () => {
    const testEmail = `test-${Date.now()}@captivia.com`;
    const testPassword = 'password123';

    it('POST /auth/register should create a new user', async () => {
      const response = await request(httpServer(app))
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          acceptTerms: true,
          ageConfirmed: true,
          locale: 'fr',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(bodyOf<AuthBody>(response).user).toHaveProperty(
        'email',
        testEmail,
      );
      expect(bodyOf<AuthBody>(response).user).toHaveProperty('locale', 'fr');

      authToken = bodyOf<AuthBody>(response).accessToken;
      userId = bodyOf<AuthBody>(response).user.id;
    });

    it('POST /auth/register with existing email should return 409', () => {
      return request(httpServer(app))
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(409);
    });

    it('POST /auth/login with valid credentials', async () => {
      const response = await request(httpServer(app))
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
    });

    it('POST /auth/login with invalid credentials should return 401', () => {
      return request(httpServer(app))
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('GET /auth/me with valid token', () => {
      return request(httpServer(app))
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', testEmail);
        });
    });

    it('GET /auth/me without token should return 401', () => {
      return request(httpServer(app)).get('/auth/me').expect(401);
    });
  });

  describe('Animals Flow', () => {
    it('POST /users/me/animals should create first animal (free)', async () => {
      const response = await request(httpServer(app))
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          speciesId: 5221172, // gecko léopard (seed local)
          name: 'Test Animal',
          sex: 'male',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'Test Animal');
      expect(response.body).toHaveProperty('speciesId', 5221172);

      animalId = bodyOf<IdBody>(response).id;
    });

    it('POST /users/me/animals should reject second animal (not premium)', () => {
      return request(httpServer(app))
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          speciesId: 5221172,
          name: 'Second Animal',
        })
        .expect(403);
    });

    it('GET /users/me/animals should return user animals', async () => {
      const response = await request(httpServer(app))
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(bodyOf<unknown[]>(response)[0]).toHaveProperty(
        'name',
        'Test Animal',
      );
    });

    it('GET /users/me/animals/:id should return animal details', () => {
      return request(httpServer(app))
        .get(`/users/me/animals/${animalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', animalId);
          expect(res.body).toHaveProperty('routines');
          expect(res.body).toHaveProperty('history');
        });
    });

    it('PATCH /users/me/animals/:id should update animal', () => {
      return request(httpServer(app))
        .patch(`/users/me/animals/${animalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          notes: 'Updated notes',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name', 'Updated Name');
          expect(res.body).toHaveProperty('notes', 'Updated notes');
        });
    });

    it('GET /users/me/animals without auth should return 401', () => {
      return request(httpServer(app)).get('/users/me/animals').expect(401);
    });
  });

  describe('Routines Flow', () => {
    let routineId: string;

    it('POST /users/me/animals/:animalId/routines should create routine', async () => {
      const response = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'nourrissage',
          frequency: 'daily',
          schedule: { time: '08:00' },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', 'nourrissage');
      expect(response.body).toHaveProperty('frequency', 'daily');

      routineId = bodyOf<IdBody>(response).id;
    });

    it('persists all supported routine types through create, update, and list', async () => {
      const ids: string[] = [];
      for (const [index, type] of routineTypes.entries()) {
        const created = await request(httpServer(app))
          .post(`/users/me/animals/${animalId}/routines`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ type, frequency: 'daily', schedule: { time: '08:00' } })
          .expect(201);

        const createdRoutine = bodyOf<{ id: string; type: string }>(created);
        expect(createdRoutine.type).toBe(type);
        ids.push(createdRoutine.id);

        const nextType = routineTypes[(index + 1) % routineTypes.length];
        const updated = await request(httpServer(app))
          .patch(`/users/me/animals/${animalId}/routines/${ids[index]}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ type: nextType })
          .expect(200);

        expect(bodyOf<{ type: string }>(updated).type).toBe(nextType);
      }

      const listed = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const persistedTypes = (listed.body as { id: string; type: string }[])
        .filter((routine) => ids.includes(routine.id))
        .map((routine) => routine.type);

      expect(new Set(persistedTypes)).toEqual(
        new Set(
          routineTypes.map(
            (_, index) => routineTypes[(index + 1) % routineTypes.length],
          ),
        ),
      );
    });

    it('POST « une seule fois » sans date → 400 (le rappel ne se déclencherait jamais)', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'nourrissage',
          frequency: 'once',
          schedule: { time: '08:00', recurrence: 'once' },
        })
        .expect(400);
    });

    it('GET /users/me/animals/:animalId/routines should return routines', async () => {
      const response = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(bodyOf<unknown[]>(response).length).toBeGreaterThan(0);
    });

    it('PATCH /users/me/animals/:animalId/routines/:id should update routine', () => {
      return request(httpServer(app))
        .patch(`/users/me/animals/${animalId}/routines/${routineId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          active: false,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('active', false);
        });
    });

    it('DELETE /users/me/animals/:animalId/routines/:id should delete routine', () => {
      return request(httpServer(app))
        .delete(`/users/me/animals/${animalId}/routines/${routineId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Action History Flow', () => {
    let logId: string;

    it('POST /users/me/animals/:animalId/history should log action', async () => {
      const response = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'nourrissage',
          note: 'Fed successfully',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', 'nourrissage');

      logId = bodyOf<IdBody>(response).id;
    });

    it('GET /users/me/animals/:animalId/history should return history', async () => {
      const response = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(bodyOf<unknown[]>(response).length).toBeGreaterThan(0);
    });

    it('DELETE /users/me/animals/:animalId/history/:id should delete log', () => {
      return request(httpServer(app))
        .delete(`/users/me/animals/${animalId}/history/${logId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Public Endpoints', () => {
    it('GET /species/:id/health should return health info', () => {
      return request(httpServer(app))
        .get('/species/123/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('speciesId', 123);
          expect(res.body).toHaveProperty('disclaimer');
        });
    });

    it('GET /species/:id/legislation should return legislation', () => {
      return request(httpServer(app))
        .get('/species/123/legislation')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('speciesId', 123);
          expect(res.body).toHaveProperty('disclaimer');
        });
    });

    it('GET /food/search should search food products', () => {
      return request(httpServer(app))
        .get('/food/search?q=dog+food')
        .expect(200);
    });

    it('GET /equipment should return equipment', () => {
      return request(httpServer(app))
        .get('/equipment')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('recommendations');
          expect(res.body).toHaveProperty('affiliate');
        });
    });
  });
});
