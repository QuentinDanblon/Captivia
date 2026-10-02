import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/create-app';

describe('Performance Tests', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    // Serveur à l'écoute sur un port éphémère (cf. test/utils/create-app.ts, BE-10).
    ({ app, url } = await createTestApp({ offlineGbif: true }));
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Response Times', () => {
    it('health endpoint should respond quickly', async () => {
      const start = Date.now();
      
      await request(url)
        .get('/health')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // < 500ms
    });

    it('species search should respond in reasonable time', async () => {
      const start = Date.now();
      
      // q=gecko : recherche profil locale (seed), pas de fallback GBIF réseau
      await request(url)
        .get('/species/search?q=gecko')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // < 2s pour une recherche locale
    }, 30000);

    it('species detail should respond quickly', async () => {
      const start = Date.now();
      
      // 5221172 = gecko léopard du seed : détail servi depuis le profil local
      await request(url)
        .get('/species/5221172')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // < 1s
    }, 30000);
  });

  describe('Cache Performance', () => {
    it('second request should be faster (cached)', async () => {
      // q=gecko : profil seed local (pas de fallback GBIF réseau)
      const endpoint = '/species/search?q=gecko';
      
      // First request (uncached)
      const start1 = Date.now();
      await request(url).get(endpoint);
      const duration1 = Date.now() - start1;
      
      // Second request (should be cached)
      const start2 = Date.now();
      await request(url).get(endpoint);
      const duration2 = Date.now() - start2;
      
      // Cached request should be faster or similar (not slower). Marge absolue de
      // 100 ms en plus des 20 % : à ~20 ms par requête, le bruit du runner CI
      // dépasse sinon la marge relative seule (test instable, BE-10).
      expect(duration2).toBeLessThanOrEqual(duration1 * 1.2 + 100);
    }, 30000);

    it('health content should cache properly', async () => {
      const endpoint = '/species/123/health';
      
      // Prime cache
      await request(url).get(endpoint);
      
      // Cached request
      const start = Date.now();
      await request(url)
        .get(endpoint)
        .expect(200);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(200); // Cached should be < 200ms
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle 10 concurrent requests', async () => {
      const requests: request.Test[] = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(url)
            .get('/health')
        );
      }

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;
      
      // All should succeed
      responses.forEach((r: any) => {
        expect(r.status).toBe(200);
      });
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(3000);
    });

    it('should handle concurrent searches', async () => {
      // Requêtes locales uniquement (profil seed) : pas de dépendance réseau GBIF
      const queries = ['gecko', 'gecko', 'gecko', 'gecko', 'gecko'];
      const requests = queries.map(q => 
        request(url)
          .get(`/species/search?q=${q}`)
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;
      
      // All should succeed
      responses.forEach(r => {
        expect(r.status).toBe(200);
      });
      
      // Concurrent execution should be faster than sequential
      expect(duration).toBeLessThan(10000); // < 10s for 5 requests
    }, 30000);
  });

  describe('Payload Sizes', () => {
    it('response payloads should be reasonable', async () => {
      const response = await request(url)
        .get('/species/search?q=gecko&limit=20')
        .expect(200);

      const payload = JSON.stringify(response.body);
      const sizeKB = Buffer.byteLength(payload) / 1024;
      
      // Payload should not be excessively large
      expect(sizeKB).toBeLessThan(500); // < 500KB for 20 results
    }, 30000);

    it('species detail payload should be manageable', async () => {
      const response = await request(url)
        .get('/species/5221172')
        .expect(200);

      const payload = JSON.stringify(response.body);
      const sizeKB = Buffer.byteLength(payload) / 1024;
      
      expect(sizeKB).toBeLessThan(100); // < 100KB for one species
    }, 30000);
  });

  describe('Database Query Performance', () => {
    it('auth endpoints should be fast', async () => {
      const testEmail = `perf-test-${Date.now()}@captivia.com`;
      
      const start = Date.now();
      await request(url)
        .post('/auth/register')
        .send({
          email: testEmail,
          password: 'password123', acceptTerms: true, ageConfirmed: true,
        });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Registration < 1s
    });
  });

  describe('Stress Test - Light Load', () => {
    it('should handle 50 requests over 5 seconds', async () => {
      const results = {
        success: 0,
        failed: 0,
      };
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(url)
            .get('/health')
            .then(() => { results.success++; })
            .catch(() => { results.failed++; })
        );
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await Promise.all(promises);
      
      // Most should succeed
      expect(results.success).toBeGreaterThan(40);
      expect(results.failed).toBeLessThan(10);
    }, 30000);
  });
});
