import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthBody, IdBody, UrlBody, bodyOf, httpServer } from './utils/http';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * W0-06 — Page publique (QR) sûre : opt-in, liste blanche, lien révocable,
 * URL construite côté serveur.
 */
/** Réponse (partielle) du lien public consultée par ces tests. */
interface PublicLinkBody {
  enabled: boolean;
  showHealth: boolean;
  slug: string;
  vaccinations: { name: string }[];
}

describe('Public animal link (W0-06)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  let premiumToken: string;
  let premiumId: string;
  let freeToken: string;
  let freeId: string;
  let otherToken: string;
  let otherId: string;
  let animalId: string;
  const previousPublicUrl = process.env.PUBLIC_WEB_URL;

  const register = async (email: string) => {
    const res = await request(httpServer(app))
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    return {
      token: bodyOf<AuthBody>(res).accessToken,
      id: bodyOf<AuthBody>(res).user.id,
    };
  };

  beforeAll(async () => {
    process.env.PUBLIC_WEB_URL = 'https://app.example.test/';
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

    const premium = await register(`pl-premium-${stamp}@captivia.com`);
    premiumToken = premium.token;
    premiumId = premium.id;
    await prisma.user.update({
      where: { id: premiumId },
      data: { isPremium: true, emailVerifiedAt: new Date() },
    });

    const free = await register(`pl-free-${stamp}@captivia.com`);
    freeToken = free.token;
    freeId = free.id;

    const other = await register(`pl-other-${stamp}@captivia.com`);
    otherToken = other.token;
    otherId = other.id;
    await prisma.user.update({
      where: { id: otherId },
      data: { isPremium: true, emailVerifiedAt: new Date() },
    });

    const animal = await request(httpServer(app))
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${premiumToken}`)
      .send({
        speciesId: 5221172,
        name: 'Public Gecko',
        sex: 'female',
        birthDate: '2021-06-15T00:00:00.000Z',
        notes: 'SECRET-NOTE-owner-only',
        photos: [
          'https://img.example.test/gecko.jpg',
          'https://img.example.test/second.jpg',
        ],
      })
      .expect(201);
    animalId = bodyOf<IdBody>(animal).id;

    await request(httpServer(app))
      .post(`/users/me/animals/${animalId}/health-records`)
      .set('Authorization', `Bearer ${premiumToken}`)
      .send({
        type: 'vaccine',
        title: 'Vaccin rage',
        date: '2024-03-01T00:00:00.000Z',
        notes: 'SECRET-HEALTH-NOTE',
        details: { vet: 'SECRET-VET-DETAIL' },
      })
      .expect(201);
    await request(httpServer(app))
      .post(`/users/me/animals/${animalId}/health-records`)
      .set('Authorization', `Bearer ${premiumToken}`)
      .send({
        type: 'surgery',
        title: 'SECRET-SURGERY',
        date: '2024-04-01T00:00:00.000Z',
      })
      .expect(201);
    await prisma.vaccination.create({
      data: {
        animalId,
        name: 'Leucose',
        date: new Date('2024-05-01T00:00:00.000Z'),
        notes: 'SECRET-VACCINATION-NOTE',
        vetName: 'SECRET-VET-NAME',
        batchNumber: 'SECRET-BATCH',
      },
    });
  });

  afterAll(async () => {
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_WEB_URL;
    else process.env.PUBLIC_WEB_URL = previousPublicUrl;
    for (const id of [premiumId, freeId, otherId]) {
      if (id) {
        await prisma.animal.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } }).catch(() => undefined);
      }
    }
    if (app) await app.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('is disabled by default: no slug, no url, public route 404', async () => {
    const res = await request(httpServer(app))
      .get(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .expect(200);
    expect(res.body).toEqual({
      enabled: false,
      showHealth: false,
      slug: null,
      url: null,
    });
  });

  it('refuses to enable for a free account (403) and for a foreign animal (403)', async () => {
    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(freeToken))
      .send({ enabled: true })
      .expect(403);
    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(otherToken))
      .send({ enabled: true })
      .expect(403);
    await request(httpServer(app))
      .post(`/users/me/animals/${animalId}/public-link/regenerate`)
      .set(auth(otherToken))
      .expect(403);
  });

  it('rejects invalid bodies', async () => {
    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .send({ enabled: 'yes' })
      .expect(400);
    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .send({ publicSlug: 'forced-slug-123456' })
      .expect(400);
  });

  let slug: string;

  it('enables the link; URL is built server-side and ignores the client baseUrl', async () => {
    const res = await request(httpServer(app))
      .patch(
        `/users/me/animals/${animalId}/public-link?locale=en&baseUrl=https://evil.test`,
      )
      .set(auth(premiumToken))
      .send({ enabled: true })
      .expect(200);
    expect(bodyOf<PublicLinkBody>(res).enabled).toBe(true);
    expect(bodyOf<PublicLinkBody>(res).showHealth).toBe(false);
    slug = bodyOf<PublicLinkBody>(res).slug;
    expect(slug).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(bodyOf<UrlBody>(res).url).toBe(
      `https://app.example.test/en/animal-public/${slug}`,
    );

    const get = await request(httpServer(app))
      .get(
        `/users/me/animals/${animalId}/public-link?baseUrl=https://evil.test&locale=xx`,
      )
      .set(auth(premiumToken))
      .expect(200);
    expect(bodyOf<UrlBody>(get).url).toBe(
      `https://app.example.test/fr/animal-public/${slug}`,
    );
  });

  it('public response is a strict whitelist (no id, notes, details, owner data)', async () => {
    const res = await request(httpServer(app))
      .get(`/public/animal/${slug}`)
      .expect(200);
    expect(Object.keys(bodyOf<object>(res)).sort()).toEqual(
      ['birthYear', 'name', 'photo', 'sex', 'species'].sort(),
    );
    expect(res.body).toMatchObject({
      name: 'Public Gecko',
      sex: 'female',
      birthYear: 2021,
      photo: 'https://img.example.test/gecko.jpg',
      species: { commonName: 'Gecko Léopard' },
    });
    const raw = JSON.stringify(res.body);
    for (const forbidden of [
      animalId,
      premiumId,
      'SECRET',
      'captivia.com',
      'second.jpg',
      'Vaccin rage',
    ]) {
      expect(raw).not.toContain(forbidden);
    }
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('exposes vaccinations (name + date only) only when showHealth is enabled', async () => {
    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .send({ showHealth: true })
      .expect(200);

    const res = await request(httpServer(app))
      .get(`/public/animal/${slug}`)
      .expect(200);
    expect(bodyOf<PublicLinkBody>(res).vaccinations).toHaveLength(2);
    for (const v of bodyOf<PublicLinkBody>(res).vaccinations) {
      expect(Object.keys(v).sort()).toEqual(['date', 'name']);
    }
    expect(
      bodyOf<PublicLinkBody>(res)
        .vaccinations.map((v) => v.name)
        .sort(),
    ).toEqual(['Leucose', 'Vaccin rage']);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('SECRET');
    expect(raw).not.toContain(animalId);

    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .send({ showHealth: false })
      .expect(200);
    const hidden = await request(httpServer(app))
      .get(`/public/animal/${slug}`)
      .expect(200);
    expect(bodyOf<PublicLinkBody>(hidden).vaccinations).toBeUndefined();
  });

  it('regenerate invalidates the old slug immediately', async () => {
    const res = await request(httpServer(app))
      .post(`/users/me/animals/${animalId}/public-link/regenerate?locale=de`)
      .set(auth(premiumToken))
      .expect(200);
    expect(bodyOf<PublicLinkBody>(res).slug).not.toBe(slug);
    expect(bodyOf<UrlBody>(res).url).toBe(
      `https://app.example.test/de/animal-public/${bodyOf<PublicLinkBody>(res).slug}`,
    );

    await request(httpServer(app)).get(`/public/animal/${slug}`).expect(404);
    await request(httpServer(app))
      .get(`/public/animal/${bodyOf<PublicLinkBody>(res).slug}`)
      .expect(200);
    slug = bodyOf<PublicLinkBody>(res).slug;
  });

  it('disabling returns 404 on the public route, re-enabling keeps the slug', async () => {
    await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .send({ enabled: false })
      .expect(200);
    const gone = await request(httpServer(app))
      .get(`/public/animal/${slug}`)
      .expect(404);
    expect(gone.headers['x-robots-tag']).toContain('noindex');

    const again = await request(httpServer(app))
      .patch(`/users/me/animals/${animalId}/public-link`)
      .set(auth(premiumToken))
      .send({ enabled: true })
      .expect(200);
    expect(bodyOf<PublicLinkBody>(again).slug).toBe(slug);
    await request(httpServer(app)).get(`/public/animal/${slug}`).expect(200);
  });

  it('returns 404 once the owner premium has expired', async () => {
    await prisma.user.update({
      where: { id: premiumId },
      data: { isPremium: false },
    });
    await request(httpServer(app)).get(`/public/animal/${slug}`).expect(404);
    await prisma.user.update({
      where: { id: premiumId },
      data: { isPremium: true },
    });
    await request(httpServer(app)).get(`/public/animal/${slug}`).expect(200);
  });

  it('malformed or unknown slugs are 404', async () => {
    await request(httpServer(app)).get('/public/animal/nope').expect(404);
    await request(httpServer(app))
      .get('/public/animal/AAAAAAAAAAAAAAAAAAAAAAAA')
      .expect(404);
  });
});
