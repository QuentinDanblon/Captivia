import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

/** Champs de consentement désormais obligatoires à l'inscription (W2-03). */
const TERMS = { acceptTerms: true, ageConfirmed: true };

describe('Edge Cases Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    if (app) await app.close();
  });

  describe('Empty and Missing Data', () => {
    it('should handle empty search query', () => {
      return request(app.getHttpServer()).get('/species/search?q=').expect(400);
    });

    it('should handle missing query parameter', () => {
      return request(app.getHttpServer()).get('/species/search').expect(400);
    });

    it('should handle non-existent species ID', () => {
      return request(app.getHttpServer()).get('/species/999999999').expect(404);
    });

    it('should handle non-existent animal ID', async () => {
      const testEmail = `edge-test-${Date.now()}@captivia.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: 'password123', ...TERMS });

      const token = response.body.accessToken;

      await request(app.getHttpServer())
        .get('/users/me/animals/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should handle empty animals list', async () => {
      const testEmail = `empty-list-${Date.now()}@captivia.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: 'password123', ...TERMS });

      const token = response.body.accessToken;

      const animalsResponse = await request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(animalsResponse.body)).toBe(true);
      expect(animalsResponse.body).toHaveLength(0);
    });
  });

  describe('Special Characters', () => {
    it('should handle search with special characters', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=%23%24%25%5E')
        .expect(200); // Should not crash
    });

    it('should handle unicode characters in search', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=🐍🦎')
        .expect(200);
    });

    it('should handle animal name with special characters', async () => {
      const testEmail = `special-char-${Date.now()}@captivia.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: 'password123', ...TERMS });

      const token = response.body.accessToken;

      await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speciesId: 5221172,
          name: "L'Animal de José & María",
        })
        .expect(201);
    });
  });

  describe('Boundary Values', () => {
    it('should handle limit=0 in search', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=boa&limit=0')
        .expect(400); // Should reject invalid limit
    });

    it('should handle negative limit', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=boa&limit=-1')
        .expect(400);
    });

    it('should handle very large limit', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=boa&limit=10000')
        .expect(400); // Should have max limit
    });

    it('should handle negative offset', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=boa&offset=-1')
        .expect(400);
    });

    it('should handle very long animal name', async () => {
      const testEmail = `long-name-${Date.now()}@captivia.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: 'password123', ...TERMS });

      const token = response.body.accessToken;
      const longName = 'A'.repeat(1000);

      // Durci : MaxLength(100) sur name → rejet 400 (plus d'acceptation silencieuse)
      await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speciesId: 5221172,
          name: longName,
        })
        .expect(400);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle double form submission', async () => {
      const testEmail = `double-submit-${Date.now()}@captivia.com`;
      const userData = { email: testEmail, password: 'password123', ...TERMS };

      const [response1, response2] = await Promise.all([
        request(app.getHttpServer()).post('/auth/register').send(userData),
        request(app.getHttpServer()).post('/auth/register').send(userData),
      ]);

      // One should succeed, one should fail with 409
      const statuses = [response1.status, response2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });

  describe('Session Expiration', () => {
    it('should handle expired token gracefully', async () => {
      // Using a JWT that looks valid but is expired/invalid
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });
  });

  describe('External API Failures', () => {
    it('should handle GBIF API timeout gracefully', async () => {
      // Search for something that might timeout or fail
      const response = await request(app.getHttpServer())
        .get('/species/search?q=xyz123nonexistent')
        .expect(200);

      // Should return empty or error gracefully, not crash
      expect(response.body).toHaveProperty('results');
    });

    it('should provide default data when external API fails', async () => {
      const response = await request(app.getHttpServer())
        .get('/species/999999/health')
        .expect(200);

      // Should return structure even if no data
      expect(response.body).toHaveProperty('speciesId');
      expect(response.body).toHaveProperty('disclaimer');
    });
  });

  describe('Malformed Requests', () => {
    it('should handle malformed JSON', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle missing Content-Type header', async () => {
      // Email unique → indépendant de l'état de la DB (les runs précédents
      // laissent des utilisateurs résiduels)
      const uniqueEmail = `no-content-type-${Date.now()}@captivia.com`;
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail, password: 'password123', ...TERMS })
        .expect((res) => {
          expect([201, 400, 415]).toContain(res.status);
        });
    });

    it('should handle array instead of object', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send([{ email: 'test@example.com', password: 'password123' }])
        .expect(400);
    });
  });

  describe('Resource Cleanup', () => {
    it('should handle deletion of non-existent resource', async () => {
      const testEmail = `cleanup-test-${Date.now()}@captivia.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: 'password123', ...TERMS });

      const token = response.body.accessToken;

      await request(app.getHttpServer())
        .delete('/users/me/animals/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should handle cascade deletion', async () => {
      const testEmail = `cascade-${Date.now()}@captivia.com`;
      const userResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: 'password123', ...TERMS });

      const token = userResponse.body.accessToken;
      const userId = userResponse.body.user.id;

      // Create animal with routines
      const animalResponse = await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId: 5221172, name: 'Cascade Test' });

      const animalId = animalResponse.body.id;

      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'nourrissage',
          frequency: 'daily',
          schedule: { time: '08:00' },
        });

      // Delete animal should cascade to routines
      await request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify cascade worked
      const routines = await prisma.routine.findMany({
        where: { animalId },
      });
      expect(routines).toHaveLength(0);

      // Cleanup
      await prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle offset beyond available results', () => {
      return request(app.getHttpServer())
        .get('/species/search?q=gecko&offset=100000')
        .expect(200);
    }, 30000);

    it('should handle pagination at exact boundary', () => {
      // q=gecko : profil seed local (1 résultat) ; offset 20 dépasse → fallback GBIF.
      // Timeout 30s car le fallback GBIF peut être lent (réseau).
      return request(app.getHttpServer())
        .get('/species/search?q=gecko&limit=20&offset=20')
        .expect(200);
    }, 30000);
  });
});
