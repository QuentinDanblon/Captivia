import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { AuthBody, ErrorBody, bodyOf, httpServer } from './utils/http';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyBodyLimits } from '../src/config/body-limits';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Régression : créer un animal avec une photo (data URL dans le JSON) renvoyait 500
 * « Internal server error » en production. Cause : limite JSON par défaut d'Express (100 Ko)
 * et erreur 413 de body-parser transformée en 500 par le filtre global.
 */
describe('Corps JSON : photos d’animal et limite de taille', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const email = `body-limits-${Date.now()}@captivia.com`;
  let token = '';

  /** Data URL JPEG d'environ `bytes` octets décodés (contenu factice, base64 valide). */
  function jpegDataUrl(bytes: number): string {
    return `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString('base64')}`;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    applyBodyLimits(app);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const res = await request(httpServer(app))
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    token = bodyOf<AuthBody>(res).accessToken;
  });

  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { email } });
    if (app) await app.close();
  });

  it('accepte un animal avec une photo d’environ 600 Ko (bien au-delà des 100 Ko par défaut)', async () => {
    const res = await request(httpServer(app))
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        speciesId: 5221172,
        name: 'Photo',
        photos: [jpegDataUrl(600 * 1024)],
      });
    expect(res.status).toBe(201);
  });

  it('corps trop gros : 413 PAYLOAD_TOO_LARGE (et non 500)', async () => {
    const res = await request(httpServer(app))
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        speciesId: 5221172,
        name: 'Trop',
        photos: [jpegDataUrl(4 * 1024 * 1024)],
      });
    expect(res.status).toBe(413);
    expect(bodyOf<ErrorBody>(res).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('JSON mal formé : 400 (et non 500)', async () => {
    const res = await request(httpServer(app))
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
  });
});
