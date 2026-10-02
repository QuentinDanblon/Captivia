import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/create-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Security Tests', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let user1AnimalId: string;

  beforeAll(async () => {
    // Serveur à l'écoute sur un port éphémère, configuré comme main.ts
    // (ValidationPipe, filtre, CORS, helmet) — cf. test/utils/create-app.ts (BE-10).
    ({ app, url } = await createTestApp({ offlineGbif: true }));

    prisma = app.get(PrismaService);

    // Create two test users
    const user1Email = `security-test-1-${Date.now()}@captivia.com`;
    const user2Email = `security-test-2-${Date.now()}@captivia.com`;
    
    const user1Response = await request(url)
      .post('/auth/register')
      .send({ email: user1Email, password: 'password123' });
    
    user1Token = user1Response.body.accessToken;
    user1Id = user1Response.body.user.id;
    
    const user2Response = await request(url)
      .post('/auth/register')
      .send({ email: user2Email, password: 'password123' });
    
    user2Token = user2Response.body.accessToken;
    user2Id = user2Response.body.user.id;

    // Create an animal for user1
    const animalResponse = await request(url)
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
      return request(url)
        .get('/users/me/animals')
        .expect(401);
    });

    it('should reject requests with invalid token', () => {
      return request(url)
        .get('/users/me/animals')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with malformed token', () => {
      return request(url)
        .get('/users/me/animals')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    it('should accept requests with valid token', () => {
      return request(url)
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });
  });

  describe('Ownership Checks - Animals', () => {
    it('should allow user to access their own animal', () => {
      return request(url)
        .get(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });

    it('should prevent user from accessing another user\'s animal', () => {
      return request(url)
        .get(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should prevent user from updating another user\'s animal', () => {
      return request(url)
        .patch(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should prevent user from deleting another user\'s animal', () => {
      return request(url)
        .delete(`/users/me/animals/${user1AnimalId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('Input Validation', () => {
    it('should reject registration with invalid email', () => {
      return request(url)
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'password123',
        })
        .expect(400);
    });

    it('should reject registration with short password', () => {
      return request(url)
        .post('/auth/register')
        .send({
          email: 'test@captivia.com',
          password: 'short',
        })
        .expect(400);
    });

    it('should reject animal creation with missing required fields', () => {
      return request(url)
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          // Missing speciesId and name
        })
        .expect(400);
    });

    it('should reject animal creation with invalid data types', () => {
      return request(url)
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          speciesId: 'not-a-number',
          name: 'Test',
        })
        .expect(400);
    });

    it('should reject unknown fields (whitelist + forbidNonWhitelisted, comme main.ts)', async () => {
      const response = await request(url)
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          speciesId: 5221172,
          name: 'Test Animal',
          unknownField: 'should be rejected',
          isPremium: true, // Should not bypass premium check
        })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('unknownField');
    });
  });

  describe('Premium Limit Enforcement', () => {
    it('should enforce premium limit for free users', async () => {
      // Test autonome (ne dépend plus d'un test précédent) : le premier animal
      // est accepté, le second dépasse la limite de l'offre gratuite.
      await request(url)
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          speciesId: 5221172,
          name: 'First Animal',
        })
        .expect(201);

      await request(url)
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
      return request(url)
        .get("/species/search?q='; DROP TABLE users; --")
        .expect(200); // Should not cause SQL error, Prisma protects
    });

    it('should handle SQL injection in ID parameter', () => {
      // DTO durci : id doit être numérique strict → 400 (validation, plus 404)
      return request(url)
        .get("/species/1' OR '1'='1")
        .expect(400);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers for allowed origin', async () => {
      const response = await request(url)
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
          request(url)
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
      
      await request(url)
        .post('/auth/register')
        .send({
          email: testEmail,
          password: password,
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
      const response = await request(url)
        .get('/auth/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should not expose other users\' data', async () => {
      const response = await request(url)
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
