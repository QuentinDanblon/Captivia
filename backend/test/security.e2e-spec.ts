import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Security Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let user1AnimalId: string;

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
    // CORS comme dans main.ts (les tests bootent AppModule sans passer par bootstrap)
    app.enableCors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: false,
    });
    await app.init();
    
    prisma = app.get(PrismaService);

    // Create two test users
    const user1Email = `security-test-1-${Date.now()}@captivia.com`;
    const user2Email = `security-test-2-${Date.now()}@captivia.com`;
    
    const user1Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user1Email, password: 'password123', acceptTerms: true, ageConfirmed: true });
    
    user1Token = user1Response.body.accessToken;
    user1Id = user1Response.body.user.id;
    
    const user2Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user2Email, password: 'password123', acceptTerms: true, ageConfirmed: true });
    
    user2Token = user2Response.body.accessToken;
    user2Id = user2Response.body.user.id;

    // Create an animal for user1
    const animalResponse = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        speciesId: 5221172,
        name: 'Security Test Animal',
      });
    
    user1AnimalId = animalResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup
    if (user1Id) {
      await prisma.animal.deleteMany({ where: { userId: user1Id } });
      await prisma.user.delete({ where: { id: user1Id } });
    }
    if (user2Id) {
      await prisma.animal.deleteMany({ where: { userId: user2Id } });
      await prisma.user.delete({ where: { id: user2Id } });
    }
    if (app) await app.close();
  });

  describe('JWT Authentication', () => {
    it('should reject requests without token', () => {
      return request(app.getHttpServer())
        .get('/users/me/animals')
        .expect(401);
    });

    it('should reject requests with invalid token', () => {
      return request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with malformed token', () => {
      return request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    it('should accept requests with valid token', () => {
      return request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });
  });

  describe('Ownership Checks - Animals', () => {
    it('should allow user to access their own animal', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });

    it('should prevent user from accessing another user\'s animal', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should prevent user from updating another user\'s animal', () => {
      return request(app.getHttpServer())
        .patch(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should prevent user from deleting another user\'s animal', () => {
      return request(app.getHttpServer())
        .delete(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('Input Validation', () => {
    it('should reject registration with invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'password123',
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(400);
    });

    it('should reject registration with short password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@captivia.com',
          password: 'short',
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(400);
    });

    it('should reject animal creation with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          // Missing speciesId and name
        })
        .expect(400);
    });

    it('should reject animal creation with invalid data types', () => {
      return request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          speciesId: 'not-a-number',
          name: 'Test',
        })
        .expect(400);
    });

    it('should strip unknown fields (whitelist)', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          speciesId: 5221172,
          name: 'Test Animal',
          unknownField: 'should be removed',
          isPremium: true, // Should not bypass premium check
        })
        .expect(201);

      expect(response.body).not.toHaveProperty('unknownField');
    });
  });

  describe('Premium Limit Enforcement', () => {
    it('should enforce premium limit for free users', async () => {
      // User2 already created one animal in previous test
      // Try to create a second one
      await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          speciesId: 5221172,
          name: 'Second Animal',
        })
        .expect(403);
    });
  });

  describe('SQL Injection Protection', () => {
    it('should handle SQL injection attempts in search', () => {
      return request(app.getHttpServer())
        .get("/species/search?q='; DROP TABLE users; --")
        .expect(200); // Should not cause SQL error, Prisma protects
    });

    it('should handle SQL injection in ID parameter', () => {
      // DTO durci : id doit être numérique strict → 400 (validation, plus 404)
      return request(app.getHttpServer())
        .get("/species/1' OR '1'='1")
        .expect(400);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers for allowed origin', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // CORS headers should be present
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should handle burst requests', async () => {
      const requests: request.Test[] = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/species/search?q=test')
        );
      }

      const responses = await Promise.all(requests);
      
      // Some should succeed, rate limiter might kick in
      const successCount = responses.filter((r: any) => r.status === 200).length;
      const rateLimitCount = responses.filter((r: any) => r.status === 429).length;
      
      expect(successCount + rateLimitCount).toBe(10);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords (not store plaintext)', async () => {
      const testEmail = `pwd-test-${Date.now()}@captivia.com`;
      const password = 'test-password-123';
      
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: password,
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(201);

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      // Password should not be stored as plaintext
      expect(user?.passwordHash).not.toEqual(password);
      expect(user?.passwordHash).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt format
      
      // Cleanup
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  describe('Data Exposure', () => {
    it('should not expose password hash in API responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should not expose other users\' data', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Should only contain user1's animals
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((animal: any) => {
        expect(animal.userId).toBe(user1Id);
      });
    });
  });
});
