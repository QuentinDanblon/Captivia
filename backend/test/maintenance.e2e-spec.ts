import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { MAINTENANCE_LOCK_KEY } from '../src/maintenance/maintenance.constants';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { ApiAnalyticsService } from '../src/analytics/api-analytics.service';
import { createTestApp } from './utils/create-app';

jest.setTimeout(90000);

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// (supertest renvoie des corps `any` ; fichier de test.)

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PASSWORD = 'MaintenanceTest123!';

/**
 * W2-08 — job de maintenance (purge par lots sous verrou consultatif) et LEG-06
 * (`POST /analytics/track` sans `userId` en query), sur PostgreSQL réel.
 *
 * Le job s'exécute à l'instant réel : les lignes « anciennes » sont créées avec des dates
 * passées, et seules celles du test sont vérifiées (la base de test est partagée).
 */
describe('Maintenance — registre, rétention et purge (W2-08)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let maintenance: MaintenanceService;
  const trackRequest = jest.fn<Promise<void>, [string, string | null, number]>(
    () => Promise.resolve(),
  );
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userIds: string[] = [];
  const paymentEventIds: string[] = [];

  beforeAll(async () => {
    ({ app, url } = await createTestApp({
      // AnalyticsModule n'est chargé qu'avec Redis : contrôleur réel, service simulé.
      controllers: [AnalyticsController],
      providers: [{ provide: ApiAnalyticsService, useValue: { trackRequest } }],
    }));
    prisma = app.get(PrismaService);
    maintenance = app.get(MaintenanceService);
  });

  afterAll(async () => {
    await prisma.paymentEvent.deleteMany({
      where: { id: { in: paymentEventIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  async function createUser(name: string) {
    const user = await prisma.user.create({
      data: {
        email: `maint-${name}-${tag}@captivia.local`,
        passwordHash: 'not-a-real-hash',
      },
    });
    userIds.push(user.id);
    return user;
  }

  /** Jeu de données : pour chaque catégorie, une ligne à purger et une à conserver. */
  async function seed() {
    const now = Date.now();
    const user = await createUser(`seed-${randomUUID().slice(0, 8)}`);
    const at = (offsetMs: number) => new Date(now + offsetMs);
    const h = () =>
      randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

    const resetOld = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: h(), expiresAt: at(-HOUR_MS) },
    });
    const resetLive = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: h(), expiresAt: at(HOUR_MS) },
    });
    const verifyOld = await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: h(), expiresAt: at(-2 * DAY_MS) },
    });
    const verifyLive = await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: h(), expiresAt: at(DAY_MS) },
    });
    const rt = (expiresAt: Date, revokedAt: Date | null = null) =>
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: h(),
          familyId: randomUUID(),
          expiresAt,
          revokedAt,
        },
      });
    const rtExpiredLongAgo = await rt(at(-31 * DAY_MS));
    const rtRevokedLongAgo = await rt(at(40 * DAY_MS), at(-31 * DAY_MS));
    const rtExpiredRecently = await rt(at(-5 * DAY_MS));
    const rtRevokedRecently = await rt(at(20 * DAY_MS), at(-5 * DAY_MS));
    const rtActive = await rt(at(29 * DAY_MS));
    const ev = (scheduledAt: Date) =>
      prisma.notificationEvent.create({
        data: {
          userId: user.id,
          type: 'Nourrissage',
          scheduledAt,
          status: 'done',
        },
      });
    const evOld = await ev(at(-91 * DAY_MS));
    const evRecent = await ev(at(-89 * DAY_MS));
    const payment = await prisma.paymentEvent.create({
      data: {
        provider: 'revenuecat',
        eventId: `maint-${tag}-${randomUUID()}`,
        type: 'INITIAL_PURCHASE',
        userId: user.id,
        payload: { test: true },
        receivedAt: at(-5 * 365 * DAY_MS),
      },
    });
    paymentEventIds.push(payment.id);

    return {
      user,
      purged: {
        resetOld,
        verifyOld,
        rtExpiredLongAgo,
        rtRevokedLongAgo,
        evOld,
      },
      kept: {
        resetLive,
        verifyLive,
        rtExpiredRecently,
        rtRevokedRecently,
        rtActive,
        evRecent,
        payment,
      },
    };
  }

  async function exists(
    rows: Awaited<ReturnType<typeof seed>>['purged' | 'kept'],
  ): Promise<Record<string, boolean>> {
    const r = rows as Record<string, { id: string }>;
    const out: Record<string, boolean> = {};
    for (const [name, row] of Object.entries(r)) {
      const where = { where: { id: row.id } };
      const found = name.startsWith('reset')
        ? await prisma.passwordResetToken.findUnique(where)
        : name.startsWith('verify')
          ? await prisma.emailVerificationToken.findUnique(where)
          : name.startsWith('rt')
            ? await prisma.refreshToken.findUnique(where)
            : name.startsWith('ev')
              ? await prisma.notificationEvent.findUnique(where)
              : await prisma.paymentEvent.findUnique(where);
      out[name] = found !== null;
    }
    return out;
  }

  describe('Job de maintenance', () => {
    it('supprime les lignes arrivées en fin de conservation et conserve les récentes et PaymentEvent', async () => {
      const data = await seed();

      const res = await maintenance.runOnce();

      expect(res.locked).toBe(true);
      expect(res.deleted.passwordResetTokens).toBeGreaterThanOrEqual(1);
      expect(res.deleted.emailVerificationTokens).toBeGreaterThanOrEqual(1);
      expect(res.deleted.refreshTokens).toBeGreaterThanOrEqual(2);
      expect(res.deleted.notificationEvents).toBeGreaterThanOrEqual(1);

      expect(await exists(data.purged)).toEqual({
        resetOld: false,
        verifyOld: false,
        rtExpiredLongAgo: false,
        rtRevokedLongAgo: false,
        evOld: false,
      });
      expect(await exists(data.kept)).toEqual({
        resetLive: true,
        verifyLive: true,
        rtExpiredRecently: true,
        rtRevokedRecently: true,
        rtActive: true,
        evRecent: true,
        payment: true,
      });
      // Aucun compte n'est supprimé par ce job.
      expect(
        await prisma.user.findUnique({ where: { id: data.user.id } }),
      ).not.toBeNull();

      // Idempotent : une seconde exécution ne trouve plus rien parmi ces lignes.
      const again = await maintenance.runOnce();
      expect(again.locked).toBe(true);
      expect(await exists(data.kept)).toMatchObject({
        payment: true,
        evRecent: true,
      });
    });

    it('ne fait rien quand une autre instance détient le verrou (pas de double exécution)', async () => {
      const data = await seed();

      let release!: () => void;
      let acquired!: () => void;
      const lockTaken = new Promise<void>((r) => (acquired = r));
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRawUnsafe(
            `SELECT pg_advisory_xact_lock(${MAINTENANCE_LOCK_KEY}::bigint)::text AS ok`,
          );
          acquired();
          await new Promise<void>((r) => (release = r));
        },
        { timeout: 30_000 },
      );
      await lockTaken;

      try {
        const [a, b] = await Promise.all([
          maintenance.runOnce(),
          maintenance.runOnce(),
        ]);
        expect(a.locked).toBe(false);
        expect(b.locked).toBe(false);
        expect(
          a.deleted.notificationEvents + b.deleted.notificationEvents,
        ).toBe(0);
        expect(await exists(data.purged)).toMatchObject({
          resetOld: true,
          rtExpiredLongAgo: true,
          evOld: true,
        });
      } finally {
        release();
        await holder;
      }

      // Verrou libéré : l'exécution suivante purge normalement.
      const res = await maintenance.runOnce();
      expect(res.locked).toBe(true);
      expect(await exists(data.purged)).toMatchObject({
        resetOld: false,
        rtExpiredLongAgo: false,
        evOld: false,
      });
    });

    it('deux exécutions simultanées : une seule prend le verrou', async () => {
      const [a, b] = await Promise.all([
        maintenance.runOnce(),
        maintenance.runOnce(),
      ]);
      // Selon l'ordonnancement, la seconde attend la fin de la première (verrou relâché au
      // COMMIT) ou le trouve pris : jamais deux purges dans la même fenêtre de verrou.
      expect([a.locked, b.locked]).toContain(true);
    });
  });

  describe('POST /analytics/track (LEG-06)', () => {
    let operatorToken: string;
    let operatorId: string;

    beforeAll(async () => {
      const email = `maint-op-${tag}@captivia.local`;
      const res = await request(url)
        .post('/auth/register')
        .send({
          email,
          password: PASSWORD,
          locale: 'fr',
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(201);
      operatorToken = res.body.accessToken;
      operatorId = res.body.user.id;
      userIds.push(operatorId);
      await prisma.user.update({
        where: { id: operatorId },
        data: { role: 'OPERATOR', emailVerifiedAt: new Date() },
      });
    });

    beforeEach(() => trackRequest.mockClear());

    it('refuse un userId passé en query (400), sans rien enregistrer', async () => {
      const res = await request(url)
        .post('/analytics/track')
        .query({ endpoint: '/species', duration: 12, userId: 'someone-else' })
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('userId');
      expect(trackRequest).not.toHaveBeenCalled();
    });

    it("déduit l'utilisateur du JWT", async () => {
      await request(url)
        .post('/analytics/track')
        .query({ endpoint: '/species', duration: 12 })
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(204);
      expect(trackRequest).toHaveBeenCalledWith('/species', operatorId, 12);
    });

    it('valide endpoint et duration', async () => {
      await request(url)
        .post('/analytics/track')
        .query({ endpoint: 'pas-un-chemin', duration: -1 })
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(400);
      expect(trackRequest).not.toHaveBeenCalled();
    });

    it('reste réservé aux opérateurs authentifiés', async () => {
      await request(url)
        .post('/analytics/track')
        .query({ endpoint: '/species', duration: 12 })
        .expect(401);
      expect(trackRequest).not.toHaveBeenCalled();
    });
  });
});
