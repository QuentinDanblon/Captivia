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

  describe('revue de sécurité — révocation complète et hygiène des jetons', () => {
    /** Donne au compte un lien calendrier actif et deux abonnements push. */
    async function seedPersistentAccess(userId: string) {
      await prisma.user.update({
        where: { id: userId },
        data: { calendarToken: sha256(`cal-${userId}`) },
      });
      for (const n of [1, 2]) {
        await prisma.pushSubscription.create({
          data: {
            userId,
            endpoint: `https://fcm.googleapis.com/fcm/send/${userId}-${n}`,
            keys: { p256dh: 'k', auth: 'a' },
          },
        });
      }
    }
    async function persistentAccess(userId: string) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { calendarToken: true },
      });
      return {
        calendarToken: user.calendarToken,
        push: await prisma.pushSubscription.count({ where: { userId } }),
      };
    }

    it('chaque refresh token porte la tokenVersion du compte ; une version périmée est refusée et sa famille révoquée', async () => {
      const reg = await register(emailFor('tv')).expect(201);
      const userId = body(reg).user.id;
      const stored = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(body(reg).refreshToken) },
      });
      expect(stored.tokenVersion).toBe(0);

      // Jeton « survivant » simulé : actif, mais émis pour une version antérieure du compte.
      await prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
      await refresh(body(reg).refreshToken).expect(401);
      const family = await prisma.refreshToken.findMany({
        where: { familyId: stored.familyId },
      });
      expect(family.every((t) => t.revokedAt !== null)).toBe(true);

      // Un jeton hérité (tokenVersion NULL, émis avant la migration) reste accepté puis versionné.
      const login = await request(server())
        .post('/auth/login')
        .send({ email: emailFor('tv'), password: PASSWORD })
        .expect(200);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(body(login).refreshToken) },
        data: { tokenVersion: null },
      });
      const rotated = await refresh(body(login).refreshToken).expect(200);
      const next = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(body(rotated).refreshToken) },
      });
      expect(next.tokenVersion).toBe(1);
    });

    it('logout-all désactive aussi le lien calendrier et supprime les abonnements push', async () => {
      const reg = await register(emailFor('all-access')).expect(201);
      const userId = body(reg).user.id;
      await seedPersistentAccess(userId);
      expect((await persistentAccess(userId)).push).toBe(2);

      await request(server())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${body(reg).accessToken}`)
        .expect(200);
      expect(await persistentAccess(userId)).toEqual({
        calendarToken: null,
        push: 0,
      });
    });

    it('change-password désactive le lien calendrier et supprime les abonnements push', async () => {
      const reg = await register(emailFor('chpw-access')).expect(201);
      const userId = body(reg).user.id;
      await seedPersistentAccess(userId);
      await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${body(reg).accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'ChangedPass456' })
        .expect(200);
      expect(await persistentAccess(userId)).toEqual({
        calendarToken: null,
        push: 0,
      });
    });

    it('reset-password révoque sessions, lien calendrier et abonnements push', async () => {
      const reg = await register(emailFor('reset-access')).expect(201);
      const userId = body(reg).user.id;
      await seedPersistentAccess(userId);
      const raw = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await request(server())
        .post('/auth/reset-password')
        .send({ token: raw, newPassword: 'ResetPass4567' })
        .expect(200);
      expect(await persistentAccess(userId)).toEqual({
        calendarToken: null,
        push: 0,
      });
      await refresh(body(reg).refreshToken).expect(401);
      await me(body(reg).accessToken).expect(401);
    });

    it('logout avec endpoint supprime l’abonnement push de cet appareil seulement', async () => {
      const reg = await register(emailFor('logout-push')).expect(201);
      const userId = body(reg).user.id;
      await seedPersistentAccess(userId);
      const victim = await register(emailFor('logout-push-other')).expect(201);
      const foreign = `https://fcm.googleapis.com/fcm/send/foreign-${tag}`;
      await prisma.pushSubscription.create({
        data: {
          userId: body(victim).user.id,
          endpoint: foreign,
          keys: { p256dh: 'k', auth: 'a' },
        },
      });

      // Endpoint d'un autre compte : ignoré (aucune suppression croisée).
      const r1 = await refresh(body(reg).refreshToken).expect(200);
      await request(server())
        .post('/auth/logout')
        .send({ refreshToken: body(r1).refreshToken, endpoint: foreign })
        .expect(200);
      expect(
        await prisma.pushSubscription.count({ where: { endpoint: foreign } }),
      ).toBe(1);

      const login = await request(server())
        .post('/auth/login')
        .send({ email: emailFor('logout-push'), password: PASSWORD })
        .expect(200);
      await request(server())
        .post('/auth/logout')
        .send({
          refreshToken: body(login).refreshToken,
          endpoint: `https://fcm.googleapis.com/fcm/send/${userId}-1`,
        })
        .expect(200);
      const left = await prisma.pushSubscription.findMany({
        where: { userId },
        select: { endpoint: true },
      });
      expect(left).toEqual([
        { endpoint: `https://fcm.googleapis.com/fcm/send/${userId}-2` },
      ]);
      await refresh(body(login).refreshToken).expect(401);
    });

    it('refresh purge (best effort) les refresh tokens expirés du compte', async () => {
      const reg = await register(emailFor('purge')).expect(201);
      const userId = body(reg).user.id;
      await prisma.refreshToken.createMany({
        data: [1, 2, 3].map((n) => ({
          userId,
          tokenHash: sha256(`expired-${tag}-${n}`),
          familyId: crypto.randomUUID(),
          expiresAt: new Date(Date.now() - n * 60_000),
        })),
      });
      await refresh(body(reg).refreshToken).expect(200);
      const deadline = Date.now() + 5_000;
      let expired = -1;
      while (Date.now() < deadline) {
        expired = await prisma.refreshToken.count({
          where: { userId, expiresAt: { lt: new Date() } },
        });
        if (expired === 0) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(expired).toBe(0);
      // Les jetons non expirés (dont l'ancien, roté, conservé pour la détection de rejeu) restent.
      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(2);
    });
  });
});
