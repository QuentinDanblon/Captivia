import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAINTENANCE_BATCH_SIZE,
  MAINTENANCE_LOCK_KEY,
  MAINTENANCE_MAX_PER_TABLE,
  maintenanceCutoffs,
} from './maintenance.constants';
import { MaintenanceService } from './maintenance.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2027-06-15T03:41:00.000Z');

/** Prisma simulé : $transaction exécute le callback avec un client de transaction factice. */
function buildPrisma(opts: {
  locked: boolean;
  /** Nombre de lignes renvoyé par chaque DELETE, selon la table visée. */
  deleteCounts?: (table: string, limit: number) => number;
}) {
  const statements: Prisma.Sql[] = [];
  const tx = {
    $queryRaw: jest.fn((sql: Prisma.Sql) => {
      statements.push(sql);
      return Promise.resolve([{ locked: opts.locked }]);
    }),
    $executeRaw: jest.fn((sql: Prisma.Sql) => {
      statements.push(sql);
      const table = /DELETE FROM "(\w+)"/.exec(sql.sql)?.[1] ?? '';
      const limit = sql.values[sql.values.length - 1] as number;
      return Promise.resolve(
        opts.deleteCounts ? opts.deleteCounts(table, limit) : 0,
      );
    }),
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return { prisma: prisma as unknown as PrismaService, tx, statements };
}

const deletesFor = (statements: Prisma.Sql[], table: string) =>
  statements.filter((s) => s.sql.startsWith(`DELETE FROM "${table}"`));

describe('maintenanceCutoffs', () => {
  it('derives the retention limits from the given instant', () => {
    const c = maintenanceCutoffs(NOW);
    expect(c.oneTimeTokensExpiredBefore).toEqual(NOW);
    expect(c.refreshTokensBefore).toEqual(
      new Date(NOW.getTime() - 30 * DAY_MS),
    );
    expect(c.notificationEventsBefore).toEqual(
      new Date(NOW.getTime() - 90 * DAY_MS),
    );
    expect(c.notificationEventsBefore.toISOString()).toBe(
      '2027-03-17T03:41:00.000Z',
    );
  });
});

describe('MaintenanceService (Prisma simulé)', () => {
  const prevEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it('does nothing when another instance holds the advisory lock', async () => {
    const { prisma, tx, statements } = buildPrisma({ locked: false });
    const res = await new MaintenanceService(prisma).runOnce(NOW);

    expect(res.locked).toBe(false);
    expect(res.deleted).toEqual({
      passwordResetTokens: 0,
      emailVerificationTokens: 0,
      refreshTokens: 0,
      notificationEvents: 0,
      communityModerationActions: 0,
      communityReports: 0,
      communityMedia: 0,
      communityHandleHolds: 0,
      communityUploadAttempts: 0,
    });
    expect(res.retried).toEqual({ decisions: 0, reports: 0 });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(statements[0].sql).toContain('pg_try_advisory_xact_lock');
    expect(statements[0].values).toEqual([MAINTENANCE_LOCK_KEY]);
  });

  it('purges each category with the simulated-date cutoffs, in batches', async () => {
    let refreshCalls = 0;
    const { prisma, statements } = buildPrisma({
      locked: true,
      deleteCounts: (table) => {
        if (table === 'RefreshToken') {
          refreshCalls++;
          // 2 lots pleins puis un lot partiel : la boucle s'arrête d'elle-même.
          return refreshCalls <= 2 ? MAINTENANCE_BATCH_SIZE : 7;
        }
        if (table === 'PasswordResetToken') return 3;
        if (table === 'EmailVerificationToken') return 2;
        if (table === 'NotificationEvent') return 11;
        if (table === 'CommunityModerationAction') return 4;
        if (table === 'CommunityReport') return 5;
        if (table === 'CommunityHandleHold') return 6;
        if (table === 'CommunityUploadAttempt') return 8;
        return 0;
      },
    });
    const res = await new MaintenanceService(prisma).runOnce(NOW);

    expect(res.locked).toBe(true);
    expect(res.deleted).toEqual({
      passwordResetTokens: 3,
      emailVerificationTokens: 2,
      refreshTokens: 2 * MAINTENANCE_BATCH_SIZE + 7,
      notificationEvents: 11,
      communityModerationActions: 4,
      communityReports: 5,
      // Sans service de médias (test unitaire) : aucune image purgée.
      communityMedia: 0,
      communityHandleHolds: 6,
      communityUploadAttempts: 8,
    });
    expect(deletesFor(statements, 'RefreshToken')).toHaveLength(3);

    const cutoffs = maintenanceCutoffs(NOW);
    const [reset] = deletesFor(statements, 'PasswordResetToken');
    expect(reset.sql).toContain('"expiresAt" <');
    expect(reset.values).toEqual([
      cutoffs.oneTimeTokensExpiredBefore,
      MAINTENANCE_BATCH_SIZE,
    ]);
    const [verify] = deletesFor(statements, 'EmailVerificationToken');
    expect(verify.values[0]).toEqual(cutoffs.oneTimeTokensExpiredBefore);
    const [refresh] = deletesFor(statements, 'RefreshToken');
    expect(refresh.sql).toContain('("expiresAt" < ? OR "revokedAt" < ?)');
    expect(refresh.values.slice(0, 2)).toEqual([
      cutoffs.refreshTokensBefore,
      cutoffs.refreshTokensBefore,
    ]);
    const [events] = deletesFor(statements, 'NotificationEvent');
    expect(events.sql).toContain('"scheduledAt" <');
    expect(events.values[0]).toEqual(new Date('2027-03-17T03:41:00.000Z'));
    const [moderation] = deletesFor(statements, 'CommunityModerationAction');
    expect(moderation.values[0]).toEqual(cutoffs.moderationBefore);
    // Une décision dont le recours est en attente n'est jamais purgée.
    expect(moderation.sql).toContain(`"appealStatus" <> 'PENDING'`);
    const [holds] = deletesFor(statements, 'CommunityHandleHold');
    expect(holds.sql).toContain('"expiresAt" <');
    expect(holds.values[0]).toEqual(NOW);
    const [attempts] = deletesFor(statements, 'CommunityUploadAttempt');
    expect(attempts.values[0]).toEqual(new Date(NOW.getTime() - DAY_MS));
    expect(cutoffs.moderationBefore).toEqual(
      new Date(NOW.getTime() - 365 * DAY_MS),
    );
    const [reports] = deletesFor(statements, 'CommunityReport');
    // Les signalements encore ouverts ne sont jamais purgés.
    expect(reports.sql).toContain(`"status" <> 'OPEN'`);
  });

  it('purge les médias communautaires orphelins dans la transaction verrouillée', async () => {
    const { prisma, tx } = buildPrisma({ locked: true });
    const purgeOrphans = jest.fn().mockResolvedValue(3);
    const service = new MaintenanceService(prisma, {
      purgeOrphans,
    } as unknown as ConstructorParameters<typeof MaintenanceService>[1]);
    const res = await service.runOnce(NOW);
    expect(res.deleted.communityMedia).toBe(3);
    expect(purgeOrphans).toHaveBeenCalledWith(NOW, tx);
  });

  it('relance les notifications de modération après la purge, si le verrou est obtenu', async () => {
    const retryNotifications = jest
      .fn()
      .mockResolvedValue({ decisions: 2, reports: 3 });
    const moderation = {
      retryNotifications,
    } as unknown as ConstructorParameters<typeof MaintenanceService>[2];
    const locked = buildPrisma({ locked: true });
    const res = await new MaintenanceService(
      locked.prisma,
      undefined,
      moderation,
    ).runOnce(NOW);
    expect(res.retried).toEqual({ decisions: 2, reports: 3 });
    expect(retryNotifications).toHaveBeenCalledWith(NOW);

    retryNotifications.mockClear();
    const busy = buildPrisma({ locked: false });
    const skipped = await new MaintenanceService(
      busy.prisma,
      undefined,
      moderation,
    ).runOnce(NOW);
    expect(skipped.retried).toEqual({ decisions: 0, reports: 0 });
    expect(retryNotifications).not.toHaveBeenCalled();
  });

  it('never deletes PaymentEvent (accounting obligations) nor any account', async () => {
    const { prisma, statements } = buildPrisma({
      locked: true,
      deleteCounts: () => 1,
    });
    await new MaintenanceService(prisma).runOnce(NOW);
    for (const s of statements) {
      expect(s.sql).not.toContain('PaymentEvent');
      expect(s.sql).not.toMatch(/DELETE FROM "User"/);
    }
  });

  it('caps the rows deleted per table and per run', async () => {
    const { prisma, statements } = buildPrisma({
      locked: true,
      deleteCounts: (table, limit) =>
        table === 'NotificationEvent' ? limit : 0,
    });
    const res = await new MaintenanceService(prisma).runOnce(NOW);
    expect(res.deleted.notificationEvents).toBe(MAINTENANCE_MAX_PER_TABLE);
    expect(deletesFor(statements, 'NotificationEvent')).toHaveLength(
      MAINTENANCE_MAX_PER_TABLE / MAINTENANCE_BATCH_SIZE,
    );
  });

  it('is disabled by MAINTENANCE_ENABLED=false and always under NODE_ENV=test', async () => {
    const { prisma } = buildPrisma({ locked: true });
    const service = new MaintenanceService(prisma);

    process.env.NODE_ENV = 'test';
    delete process.env.MAINTENANCE_ENABLED;
    expect(service.enabled).toBe(false);

    process.env.NODE_ENV = 'production';
    expect(service.enabled).toBe(true);
    process.env.MAINTENANCE_ENABLED = 'false';
    expect(service.enabled).toBe(false);

    const run = jest.spyOn(service, 'runOnce');
    await service.handleCron();
    expect(run).not.toHaveBeenCalled();
  });

  it('logs the counts and swallows errors in the cron entry point', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MAINTENANCE_ENABLED = 'true';
    const { prisma } = buildPrisma({
      locked: true,
      deleteCounts: (table) => (table === 'NotificationEvent' ? 4 : 0),
    });
    const service = new MaintenanceService(prisma);
    const logger = (
      service as unknown as { logger: { log: jest.Mock; error: jest.Mock } }
    ).logger;
    const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    const error = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);

    await service.handleCron();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /4 événement\(s\) de rappel, 0 décision\(s\) de modération, .* supprimé\(s\) ; 0 notification\(s\) de modération relancée\(s\) en \d+ ms/,
      ),
    );

    jest.spyOn(service, 'runOnce').mockRejectedValueOnce(new Error('boom'));
    await expect(service.handleCron()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('Maintenance en échec : boom');
  });
});
