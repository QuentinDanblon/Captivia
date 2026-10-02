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
 * W1-01 — refresh tokens rotatifs : rotation, réutilisation détectée (révocation de la
 * famille), rotations concurrentes, logout, logout-all, change-password.
 */
describe('Auth E2E — refresh tokens (W1-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const PASSWORD = 'RefreshTok123!';
  const tag = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emailFor = (name: string) => `rt-${name}-${tag}@captivia.local`;
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
  const refresh = (refreshToken: string) =>
    request(server()).post('/auth/refresh').send({ refreshToken });
  const me = (accessToken: string) =>
    request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

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
      // E-mail de vérification envoyé à l'inscription : neutralisé ici.
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { endsWith: `-${tag}@captivia.local` } },
      });
    }
    if (app) await app.close();
  });

  describe('W1-01 — refresh tokens', () => {
    it('login/register renvoient {accessToken, refreshToken} ; seul le hash est stocké', async () => {
      const email = emailFor('pair');
      const reg = await register(email).expect(201);
      expect(body(reg).accessToken).toEqual(expect.any(String));
      expect(body(reg).refreshToken).toMatch(/^[a-f0-9]{64}$/);
      expect(body(reg).user.emailVerified).toBe(false);

      const login = await request(server())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      expect(body(login).refreshToken).toMatch(/^[a-f0-9]{64}$/);

      const rows = await prisma.refreshToken.findMany({
        where: { user: { email } },
      });
      expect(rows).toHaveLength(2);
      // Deux sessions = deux familles distinctes
      expect(new Set(rows.map((r) => r.familyId)).size).toBe(2);
      const hashes = rows.map((r) => r.tokenHash);
      expect(hashes).toContain(sha256(body(login).refreshToken));
      expect(hashes).not.toContain(body(login).refreshToken);
      const regRow = rows.find(
        (r) => r.tokenHash === sha256(body(reg).refreshToken),
      )!;
      expect(regRow.userAgent).toBe('jest-e2e');
      const ttlDays =
        (regRow.expiresAt.getTime() - regRow.createdAt.getTime()) / 86400000;
      expect(ttlDays).toBeGreaterThan(29.9);
      expect(ttlDays).toBeLessThan(30.1);

      // Access token : 30 min
      const claims = JSON.parse(
        Buffer.from(
          body(login).accessToken.split('.')[1],
          'base64url',
        ).toString(),
      ) as { iat: number; exp: number };
      expect(claims.exp - claims.iat).toBe(30 * 60);
    });

    it('rotation : chaque refresh émet une nouvelle paire et consomme l’ancien token', async () => {
      const reg = await register(emailFor('rotate')).expect(201);
      const first = body(reg).refreshToken;

      const r1 = await refresh(first).expect(200);
      expect(body(r1).refreshToken).not.toBe(first);
      await me(body(r1).accessToken).expect(200);

      const r2 = await refresh(body(r1).refreshToken).expect(200);
      await me(body(r2).accessToken).expect(200);

      const old = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(first) },
      });
      expect(old.revokedAt).toBeInstanceOf(Date);
      expect(old.replacedById).toEqual(expect.any(String));
      const next = await prisma.refreshToken.findUniqueOrThrow({
        where: { id: old.replacedById! },
      });
      expect(next.tokenHash).toBe(sha256(body(r1).refreshToken));
      expect(next.familyId).toBe(old.familyId);
    });

    it('réutilisation d’un token déjà roté → 401 et révocation de toute la famille', async () => {
      const reg = await register(emailFor('reuse')).expect(201);
      const stolen = body(reg).refreshToken;
      const r1 = await refresh(stolen).expect(200);
      const current = body(r1).refreshToken;

      // L'attaquant rejoue l'ancien token
      await refresh(stolen).expect(401);

      // Le token légitime le plus récent est révoqué aussi
      await refresh(current).expect(401);
      const family = await prisma.refreshToken.findMany({
        where: { user: { email: emailFor('reuse') } },
      });
      expect(family.length).toBeGreaterThanOrEqual(2);
      expect(family.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('rotations concurrentes du même token : une seule réussit', async () => {
      const reg = await register(emailFor('race')).expect(201);
      const token = body(reg).refreshToken;
      const results = await Promise.all([refresh(token), refresh(token)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 401]);
    });

    it('refresh inconnu, expiré ou malformé → 401 / 400', async () => {
      await refresh('a'.repeat(64)).expect(401);
      await request(server()).post('/auth/refresh').send({}).expect(400);

      const reg = await register(emailFor('expired')).expect(201);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(body(reg).refreshToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await refresh(body(reg).refreshToken).expect(401);
    });

    it('logout révoque la session (famille) sans toucher les autres', async () => {
      const email = emailFor('logout');
      const reg = await register(email).expect(201);
      const other = await request(server())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const r1 = await refresh(body(reg).refreshToken).expect(200);

      await request(server())
        .post('/auth/logout')
        .send({ refreshToken: body(r1).refreshToken })
        .expect(200);
      await refresh(body(r1).refreshToken).expect(401);
      // Idempotent et muet sur un token inconnu
      await request(server())
        .post('/auth/logout')
        .send({ refreshToken: 'b'.repeat(64) })
        .expect(200);

      // L'autre appareil reste connecté
      await refresh(body(other).refreshToken).expect(200);
    });

    it('logout-all révoque tous les refresh tokens et invalide les access tokens (tokenVersion++)', async () => {
      const email = emailFor('all');
      const reg = await register(email).expect(201);
      const other = await request(server())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const before = await prisma.user.findUniqueOrThrow({ where: { email } });

      await request(server()).post('/auth/logout-all').expect(401);
      await request(server())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${body(reg).accessToken}`)
        .expect(200);

      const after = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(after.tokenVersion).toBe(before.tokenVersion + 1);
      await me(body(reg).accessToken).expect(401);
      await me(body(other).accessToken).expect(401);
      await refresh(body(reg).refreshToken).expect(401);
      await refresh(body(other).refreshToken).expect(401);

      // Une nouvelle connexion fonctionne
      const again = await request(server())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      await me(body(again).accessToken).expect(200);
    });

    it('change-password révoque les refresh tokens et renvoie une nouvelle paire', async () => {
      const reg = await register(emailFor('chpw')).expect(201);
      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${body(reg).accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'ChangedPass456' })
        .expect(200);
      expect(body(res).refreshToken).toMatch(/^[a-f0-9]{64}$/);
      await refresh(body(reg).refreshToken).expect(401);
      const r = await refresh(body(res).refreshToken).expect(200);
      await me(body(r).accessToken).expect(200);
    });
  });
});
