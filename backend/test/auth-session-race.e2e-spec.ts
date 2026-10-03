import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { AuthService, hashResetToken } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';

jest.setTimeout(300_000);

/**
 * Non-régression (revue de sécurité, constat 1) : une boucle de refresh concurrente ne doit
 * JAMAIS faire survivre une session à « se déconnecter de tous les appareils », au changement
 * ni à la réinitialisation du mot de passe.
 *
 * Avant correctif (READ COMMITTED) : le jeton inséré par une rotation concurrente, après
 * l'instantané de l'`updateMany` de révocation, restait actif (sessions survivantes observées).
 * Correctif : `SELECT … FOR UPDATE` sur la ligne User au début de chaque transaction de refresh
 * et de révocation, plus `RefreshToken.tokenVersion` vérifié au refresh.
 */
type Mode = 'logoutAll' | 'changePassword' | 'resetPassword';

const TRIALS = 40;
const PASSWORD_A = 'RacePass1234!';
const PASSWORD_B = 'RacePass5678!';

const decodeTokenVersion = (accessToken: string): number =>
  (
    JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString(),
    ) as { tokenVersion?: number }
  ).tokenVersion ?? 0;

describe('Auth — refresh concurrent vs révocation (course, constat 1)', () => {
  let app: INestApplication;
  let auth: AuthService;
  let prisma: PrismaService;
  let hashA: string;
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    auth = app.get(AuthService);
    prisma = app.get(PrismaService);
    jest
      .spyOn(app.get(MailService), 'sendEmailVerification')
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
    hashA = await bcrypt.hash(PASSWORD_A, 10);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { endsWith: `-${tag}@captivia.local` } },
      });
    }
    if (app) await app.close();
  });

  /** Un essai : renvoie true si la session « attaquante » survit à la révocation. */
  async function trial(i: number, mode: Mode): Promise<boolean> {
    const user = await prisma.user.create({
      data: {
        email: `race-${mode.toLowerCase()}-${i}-${tag}@captivia.local`,
        passwordHash: hashA,
      },
    });
    const login = await auth.login({
      email: user.email!,
      password: PASSWORD_A,
    });
    const attackerFamily = (
      await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashResetToken(login.refreshToken) },
        select: { familyId: true },
      })
    ).familyId;

    let current = login.refreshToken;
    let stop = false;
    let revokedDone = false;
    let survived = false;
    const attacker = (async () => {
      while (!stop) {
        try {
          const pair = await auth.refresh(current);
          current = pair.refreshToken;
          if (revokedDone) {
            const valid = await auth.validateUser(
              user.id,
              decodeTokenVersion(pair.accessToken),
            );
            if (valid) {
              survived = true;
              stop = true;
            }
          }
        } catch {
          stop = true;
        }
      }
    })();

    await new Promise((r) => setTimeout(r, 5 + Math.random() * 20));
    if (mode === 'logoutAll') {
      await auth.logoutAll(user.id);
    } else if (mode === 'changePassword') {
      await auth.changePassword(user.id, PASSWORD_A, PASSWORD_B);
    } else {
      const raw = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(raw),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await auth.resetPassword(raw, PASSWORD_B);
    }
    revokedDone = true;
    await new Promise((r) => setTimeout(r, 30));
    stop = true;
    await attacker;

    if (!survived) {
      // Dernière chance : le dernier jeton connu de l'attaquant est-il encore utilisable ?
      try {
        const pair = await auth.refresh(current);
        if (
          await auth.validateUser(user.id, decodeTokenVersion(pair.accessToken))
        )
          survived = true;
      } catch {
        /* révoqué : attendu */
      }
    }
    // Aucun jeton actif ne doit rester dans la famille de l'attaquant.
    const active = await prisma.refreshToken.count({
      where: { familyId: attackerFamily, revokedAt: null },
    });
    if (active > 0) survived = true;

    await prisma.user.delete({ where: { id: user.id } });
    return survived;
  }

  it.each<Mode>(['logoutAll', 'changePassword', 'resetPassword'])(
    `%s : 0 session survivante sur ${TRIALS} essais`,
    async (mode) => {
      let survivors = 0;
      for (let i = 0; i < TRIALS; i++) if (await trial(i, mode)) survivors++;
      expect(survivors).toBe(0);
    },
  );
});
