import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthRateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { MailService } from '../src/mail/mail.service';

jest.setTimeout(60000);

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; emailVerified: boolean };
}
const body = (res: { body: unknown }): AuthBody => res.body as AuthBody;
const sha256 = (v: string) =>
  crypto.createHash('sha256').update(v).digest('hex');

/**
 * W2-04 — vérification d'e-mail : token haché 24 h, usage unique, renvoi limité,
 * lien public réservé aux comptes vérifiés.
 */
describe('Auth E2E — vérification d’e-mail (W2-04)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const PASSWORD = 'RefreshTok123!';
  const tag = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emailFor = (name: string) => `ev-${name}-${tag}@captivia.local`;
  const server = (): App => app.getHttpServer() as App;

  function register(email: string) {
    return request(server())
      .post('/auth/register')
      .set('User-Agent', 'jest-e2e')
      .send({
        email,
        password: PASSWORD,
        acceptTerms: true,
        ageConfirmed: true,
      });
  }
  const me = (accessToken: string) =>
    request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

  /** Dernier lien de vérification « envoyé » pour `to` (MailService espionné). */
  let sentLinks: { to: string; link: string }[] = [];
  async function waitForLink(to: string): Promise<string> {
    for (let i = 0; i < 50; i++) {
      const found = [...sentLinks].reverse().find((l) => l.to === to);
      if (found) return found.link;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`aucun e-mail de vérification pour ${to}`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
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
    mail = app.get(MailService);
    jest
      .spyOn(mail, 'sendEmailVerification')
      .mockImplementation((to: string, _locale, link: string) => {
        sentLinks.push({ to, link });
        return Promise.resolve({ sent: true, simulated: true, attempts: 1 });
      });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { endsWith: `-${tag}@captivia.local` } },
      });
    }
    if (app) await app.close();
  });

  beforeEach(() => {
    sentLinks = [];
  });

  describe('W2-04 — vérification d’e-mail', () => {
    it('inscription → e-mail avec token haché (24 h) → verify-email marque le compte vérifié', async () => {
      const email = emailFor('verify');
      const reg = await register(email).expect(201);
      const link = await waitForLink(email);
      const token = new URL(link).searchParams.get('token')!;
      expect(link).toContain('/verifier-email?token=');
      expect(token).toMatch(/^[a-f0-9]{64}$/);

      const rows = await prisma.emailVerificationToken.findMany({
        where: { user: { email } },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(sha256(token));
      const ttlH =
        (rows[0].expiresAt.getTime() - rows[0].createdAt.getTime()) / 3600000;
      expect(ttlH).toBeGreaterThan(23.9);
      expect(ttlH).toBeLessThan(24.1);

      const meBefore = await me(body(reg).accessToken).expect(200);
      expect(meBefore.body).toMatchObject({ emailVerified: false });

      // Le hash n'est pas un token valide
      await request(server())
        .post('/auth/verify-email')
        .send({ token: rows[0].tokenHash })
        .expect(400);

      await request(server())
        .post('/auth/verify-email')
        .send({ token })
        .expect(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
      const meAfter = await me(body(reg).accessToken).expect(200);
      expect(meAfter.body).toMatchObject({ emailVerified: true });

      // Usage unique
      await request(server())
        .post('/auth/verify-email')
        .send({ token })
        .expect(400);
    });

    it('token expiré → 400', async () => {
      const email = emailFor('verify-exp');
      await register(email).expect(201);
      const token = new URL(await waitForLink(email)).searchParams.get(
        'token',
      )!;
      await prisma.emailVerificationToken.updateMany({
        where: { tokenHash: sha256(token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await request(server())
        .post('/auth/verify-email')
        .send({ token })
        .expect(400);
    });

    it('renvoi limité : 1 par minute et par compte, rien si déjà vérifié', async () => {
      const email = emailFor('resend');
      const reg = await register(email).expect(201);
      const access = body(reg).accessToken;
      await waitForLink(email);

      await request(server()).post('/auth/resend-verification').expect(401);

      // Lien envoyé à l'inscription il y a moins d'une minute → 429
      const limited = await request(server())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${access}`)
        .expect(429);
      expect(typeof (limited.body as { retryAfter?: unknown }).retryAfter).toBe(
        'number',
      );

      // Après le délai : nouvel envoi, l'ancien lien est invalidé
      const firstToken = new URL(await waitForLink(email)).searchParams.get(
        'token',
      )!;
      await prisma.emailVerificationToken.updateMany({
        where: { user: { email } },
        data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
      });
      sentLinks = [];
      await request(server())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
        .expect((res) =>
          expect(res.body).toMatchObject({ alreadyVerified: false }),
        );
      const secondToken = new URL(await waitForLink(email)).searchParams.get(
        'token',
      )!;
      expect(secondToken).not.toBe(firstToken);
      await request(server())
        .post('/auth/verify-email')
        .send({ token: firstToken })
        .expect(400);
      await request(server())
        .post('/auth/verify-email')
        .send({ token: secondToken })
        .expect(200);

      sentLinks = [];
      const done = await request(server())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${access}`)
        .expect(200);
      expect(done.body).toMatchObject({ alreadyVerified: true });
      expect(sentLinks).toHaveLength(0);
    });

    it('renvoi plafonné à 5 envois par 24 h et par compte (inscription comprise), en plus du délai de 60 s', async () => {
      const email = emailFor('cap');
      const reg = await register(email).expect(201);
      const access = body(reg).accessToken;
      await waitForLink(email);
      const resend = () =>
        request(server())
          .post('/auth/resend-verification')
          .set('Authorization', `Bearer ${access}`);
      /** Vieillit tous les envois du compte (sortie du délai de 60 s, pas de la fenêtre de 24 h). */
      const age = (ms: number) =>
        prisma.$executeRaw`UPDATE "EmailVerificationToken" SET "createdAt" = "createdAt" - (${ms}::int * interval '1 millisecond') WHERE "userId" = (SELECT "id" FROM "User" WHERE "email" = ${email})`;

      // Inscription = envoi n° 1 ; renvois n° 2 à 5 acceptés (un par « minute »).
      for (let i = 2; i <= 5; i++) {
        await age(2 * 60_000);
        await resend().expect(200);
      }
      await age(2 * 60_000);
      sentLinks = [];
      const capped = await resend().expect(429);
      const retryAfter = (capped.body as { retryAfter?: number }).retryAfter;
      expect(typeof retryAfter).toBe('number');
      // Le plus ancien envoi sort de la fenêtre dans ~24 h − 8 min.
      expect(retryAfter).toBeGreaterThan(23 * 3600);
      expect(sentLinks).toHaveLength(0);
      // Seul le dernier lien reste valide ; les précédents (journal des envois) sont expirés.
      const rows = await prisma.emailVerificationToken.findMany({
        where: { user: { email } },
      });
      expect(rows).toHaveLength(5);
      expect(rows.filter((r) => r.expiresAt > new Date())).toHaveLength(1);

      // 24 h plus tard, l'envoi le plus ancien sort de la fenêtre : un nouvel envoi est permis.
      await age(24 * 3600_000 - 7 * 60_000);
      await resend().expect(200);
    });

    it('renvois simultanés : un seul passe (contrôle et écriture sous verrou)', async () => {
      const email = emailFor('cap-race');
      const reg = await register(email).expect(201);
      const access = body(reg).accessToken;
      await waitForLink(email);
      await prisma.emailVerificationToken.updateMany({
        where: { user: { email } },
        data: { createdAt: new Date(Date.now() - 2 * 60_000) },
      });
      const results = await Promise.all(
        [1, 2, 3, 4].map(() =>
          request(server())
            .post('/auth/resend-verification')
            .set('Authorization', `Bearer ${access}`),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 429, 429, 429]);
      expect(
        await prisma.emailVerificationToken.count({
          where: { user: { email } },
        }),
      ).toBe(2);
    });

    it('activer le lien public d’un animal exige un e-mail vérifié', async () => {
      const email = emailFor('public');
      const reg = await register(email).expect(201);
      const access = body(reg).accessToken;
      await prisma.user.update({
        where: { email },
        data: { isPremium: true },
      });
      const animal = await request(server())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${access}`)
        .send({ speciesId: 5221172, name: 'Verif' })
        .expect(201);
      const animalId = (animal.body as { id: string }).id;

      const denied = await request(server())
        .patch(`/users/me/animals/${animalId}/public-link`)
        .set('Authorization', `Bearer ${access}`)
        .send({ enabled: true })
        .expect(403);
      expect(denied.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

      await prisma.user.update({
        where: { email },
        data: { emailVerifiedAt: new Date() },
      });
      await request(server())
        .patch(`/users/me/animals/${animalId}/public-link`)
        .set('Authorization', `Bearer ${access}`)
        .send({ enabled: true })
        .expect(200);
    });
  });
});
