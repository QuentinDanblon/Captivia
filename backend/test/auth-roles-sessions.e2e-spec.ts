import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthRateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { CURRENT_TERMS_VERSION } from '../src/auth/auth.constants';

jest.setTimeout(60000);

/** Corps des réponses /auth/* (register, login, me, change-password). */
interface AuthBody {
  accessToken: string;
  user: { id: string; email: string; role: string; isPremium: boolean };
  role: string;
  isPremium: boolean;
}
const body = (res: { body: unknown }): AuthBody => res.body as AuthBody;

/**
 * W0-01 / W1-01 / W2-03 / W0-04 — verrouillage :
 *  - emails normalisés (unicité insensible à la casse, pas d'élévation opérateur) ;
 *  - rôle OPERATOR uniquement en base ;
 *  - révocation des sessions (tokenVersion) au reset / changement de mot de passe ;
 *  - consentement CGU + âge obligatoire ;
 *  - token de reset stocké haché.
 */
describe('Auth E2E — rôles, emails normalisés, sessions, consentement', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const PASSWORD = 'AuthRoles123!';
  const tag = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emailFor = (name: string) => `auth-${name}-${tag}@captivia.local`;
  const OPERATOR_EMAIL = emailFor('op');
  const prevOperatorEmails = process.env.OPERATOR_EMAILS;

  const server = (): App => app.getHttpServer() as App;

  function register(email: string, extra: Record<string, unknown> = {}) {
    return request(server())
      .post('/auth/register')
      .send({
        email,
        password: PASSWORD,
        acceptTerms: true,
        ageConfirmed: true,
        ...extra,
      });
  }

  beforeAll(async () => {
    // L'ancienne variable ne doit plus donner aucun droit.
    process.env.OPERATOR_EMAILS = OPERATOR_EMAIL;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      // Rate limit auth partagé (10/min) : neutralisé pour cette suite
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
  });

  afterAll(async () => {
    process.env.OPERATOR_EMAILS = prevOperatorEmails;
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { endsWith: `-${tag}@captivia.local` } },
      });
    }
    if (app) await app.close();
  });

  describe('W0-01 — emails normalisés et rôle opérateur', () => {
    it('stocke l’email en minuscules et sans espaces', async () => {
      const res = await register(
        `  ${emailFor('Mixed').toUpperCase()}  `,
      ).expect(201);
      expect(body(res).user.email).toBe(emailFor('mixed'));
      expect(body(res).user.role).toBe('USER');
    });

    it('une variante de casse d’un email existant → 409', async () => {
      await register(emailFor('case')).expect(201);
      await register(emailFor('case').toUpperCase()).expect(409);
      await register(` ${emailFor('CASE')} `).expect(409);
    });

    it('login insensible à la casse', async () => {
      await request(server())
        .post('/auth/login')
        .send({ email: emailFor('case').toUpperCase(), password: PASSWORD })
        .expect(200);
    });

    it('la base refuse un email non normalisé (CHECK)', async () => {
      await expect(
        prisma.user.create({
          data: { email: emailFor('RAW'), passwordHash: 'x' },
        }),
      ).rejects.toThrow();
    });

    let opToken: string;
    let opId: string;

    it('email listé dans OPERATOR_EMAILS, inscrit en MAJUSCULES → aucun droit (403, pas premium)', async () => {
      const res = await register(OPERATOR_EMAIL.toUpperCase()).expect(201);
      opToken = body(res).accessToken;
      opId = body(res).user.id;
      expect(body(res).user.role).toBe('USER');
      expect(body(res).user.isPremium).toBe(false);

      await request(server())
        .post(`/admin/users/${opId}/premium`)
        .set('Authorization', `Bearer ${opToken}`)
        .send({})
        .expect(403);

      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${opToken}`)
        .expect(200);
      expect(body(me).isPremium).toBe(false);
    });

    it('le rôle OPERATOR attribué en base (CLI) ouvre les routes opérateur', async () => {
      await prisma.user.update({
        where: { id: opId },
        data: { role: UserRole.OPERATOR },
      });

      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${opToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ role: 'OPERATOR', isPremium: true });

      await request(server())
        .post(`/admin/users/${opId}/premium`)
        .set('Authorization', `Bearer ${opToken}`)
        .send({})
        .expect(200);
    });
  });

  describe('W2-03 — consentement à l’inscription', () => {
    it.each([
      ['sans acceptTerms', { acceptTerms: undefined }],
      ['acceptTerms=false', { acceptTerms: false }],
      ['sans ageConfirmed', { ageConfirmed: undefined }],
      ['ageConfirmed=false', { ageConfirmed: false }],
      ['mot de passe de 9 caractères', { password: '123456789' }],
    ])('register %s → 400', async (_label, extra) => {
      await register(
        emailFor(`terms-${Math.random().toString(36).slice(2, 8)}`),
        extra,
      ).expect(400);
    });

    it('enregistre date et version des CGU', async () => {
      const email = emailFor('terms-ok');
      await register(email).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.termsVersion).toBe(CURRENT_TERMS_VERSION);
      expect(user.termsAcceptedAt).toBeInstanceOf(Date);
      expect(user.role).toBe(UserRole.USER);
    });
  });

  describe('W1-01 / W0-04 — sessions et reset de mot de passe', () => {
    it('le token de reset est stocké haché (sha256) et le lien loggé (dev) correspond', async () => {
      const email = emailFor('reset');
      const reg = await register(email).expect(201);
      const oldToken: string = body(reg).accessToken;

      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      let logged = '';
      try {
        await request(server())
          .post('/auth/forgot-password')
          .send({ email: email.toUpperCase() })
          .expect(200);
        await new Promise((r) => setImmediate(r));
        logged = warn.mock.calls.flat().map(String).join('\n');
      } finally {
        warn.mockRestore();
      }

      const match = logged.match(/reset-password\?token=([a-f0-9]{64})/);
      expect(match).not.toBeNull();
      const plainToken = match![1];

      const rows = await prisma.passwordResetToken.findMany({
        where: { user: { email } },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(
        crypto.createHash('sha256').update(plainToken).digest('hex'),
      );
      expect(rows[0].tokenHash).not.toBe(plainToken);

      // Le hash lui-même n'est pas un token valide
      await request(server())
        .post('/auth/reset-password')
        .send({ token: rows[0].tokenHash, newPassword: 'BrandNewPass123' })
        .expect(400);

      await request(server())
        .post('/auth/reset-password')
        .send({ token: plainToken, newPassword: 'BrandNewPass123' })
        .expect(200);

      // Ancienne session révoquée
      await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      // Token à usage unique
      await request(server())
        .post('/auth/reset-password')
        .send({ token: plainToken, newPassword: 'AnotherPass1234' })
        .expect(400);

      // Le nouveau mot de passe fonctionne
      const login = await request(server())
        .post('/auth/login')
        .send({ email, password: 'BrandNewPass123' })
        .expect(200);
      await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body(login).accessToken}`)
        .expect(200);
    });

    it('changer de mot de passe révoque les anciens tokens et en renvoie un nouveau', async () => {
      const email = emailFor('change');
      const reg = await register(email).expect(201);
      const oldToken: string = body(reg).accessToken;

      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'ChangedPass123' })
        .expect(200);

      await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body(res).accessToken}`)
        .expect(200);
    });

    it('refuse un token signé avec un autre algorithme (HS512)', async () => {
      const email = emailFor('alg');
      const reg = await register(email).expect(201);
      const secret = process.env.JWT_SECRET as string;
      const b64 = (o: object) =>
        Buffer.from(JSON.stringify(o)).toString('base64url');
      const header = b64({ alg: 'HS512', typ: 'JWT' });
      const payload = b64({
        sub: body(reg).user.id,
        email,
        tokenVersion: 0,
        exp: Math.floor(Date.now() / 1000) + 600,
      });
      const sig = crypto
        .createHmac('sha512', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');

      await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${header}.${payload}.${sig}`)
        .expect(401);
    });
  });
});
