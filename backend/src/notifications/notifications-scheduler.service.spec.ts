import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { GradeModule } from '../grade/grade.module';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import {
  NotificationsSchedulerService,
  REMINDERS_LOCK_KEY,
  localDay,
  normalizeChannel,
} from './notifications-scheduler.service';
import { PUSH_SENDER, PushReminderPayload } from './push-sender';

describe('reminder helpers', () => {
  it('computes the local day in the user timezone', () => {
    const now = new Date('2026-03-10T23:30:00Z');
    expect(localDay(now, 'Europe/Paris')).toBe('2026-03-11');
    expect(localDay(now, 'America/New_York')).toBe('2026-03-10');
    expect(localDay(now, 'Invalid/Zone')).toBe('2026-03-11'); // repli Europe/Paris
  });

  it('normalizes the delivery channel (push by default)', () => {
    expect(normalizeChannel('email')).toBe('email');
    expect(normalizeChannel('both')).toBe('both');
    expect(normalizeChannel('sms')).toBe('push');
    expect(normalizeChannel(undefined)).toBe('push');
  });
});

/** Prisma réel sur la base de test (DATABASE_URL). */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('NotificationsSchedulerService (Prisma réel)', () => {
  let prisma: PrismaService;
  let scheduler: NotificationsSchedulerService;
  let mail: MailService;
  let sendCareReminder: jest.SpyInstance<
    ReturnType<MailService['sendCareReminder']>,
    Parameters<MailService['sendCareReminder']>
  >;
  const sendToUser = jest.fn<Promise<boolean>, [string, PushReminderPayload]>();
  const push = { sendToUser };
  const pushesTo = (userId: string) =>
    sendToUser.mock.calls.filter((c) => c[0] === userId);
  const userIds: string[] = [];

  // Date fixe dans le futur : isole les événements du test des données de seed « réelles ».
  const NOW = new Date('2031-03-10T08:03:00Z');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, GradeModule, MailModule],
      providers: [
        NotificationsSchedulerService,
        { provide: PUSH_SENDER, useValue: push },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    scheduler = moduleRef.get(NotificationsSchedulerService);
    mail = moduleRef.get(MailService);
    await prisma.$connect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sendToUser.mockResolvedValue(true);
    sendCareReminder = jest
      .spyOn(mail, 'sendCareReminder')
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    // Événements générés pour les comptes de seed à la date fictive du test.
    await prisma.notificationEvent.deleteMany({
      where: {
        scheduledAt: {
          gte: new Date('2031-03-10T00:00:00Z'),
          lt: new Date('2031-03-11T00:00:00Z'),
        },
      },
    });
    await prisma.$disconnect();
  });

  async function createUser(
    deliveryChannel: string | null,
    extra: { locale?: string; timezone?: string } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        email: `reminders-${randomUUID()}@example.test`,
        passwordHash: 'x',
        locale: extra.locale ?? 'fr',
        timezone: extra.timezone ?? 'Europe/Paris',
      },
    });
    userIds.push(user.id);
    if (deliveryChannel) {
      await prisma.notificationPreference.create({
        data: {
          userId: user.id,
          types: {},
          schedule: { start: '00:00', end: '23:59' },
          deliveryChannel,
        },
      });
    }
    return user;
  }

  function createDueEvent(
    userId: string,
    scheduledAt = new Date(NOW.getTime() - 60_000),
  ) {
    return prisma.notificationEvent.create({
      data: {
        userId,
        type: 'medication',
        label: 'Vermifuge',
        scheduledAt,
        status: 'pending',
        sourceKey: `test:${randomUUID()}`,
      },
    });
  }

  const mailsTo = (email: string) =>
    sendCareReminder.mock.calls.filter((c) => c[0] === email);

  it('does nothing when another instance holds the advisory lock', async () => {
    const user = await createUser('email');
    const ev = await createDueEvent(user.id);

    let release!: () => void;
    let acquired!: () => void;
    const lockTaken = new Promise<void>((r) => (acquired = r));
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REMINDERS_LOCK_KEY}::bigint)::text AS ok`,
        );
        acquired();
        await new Promise<void>((r) => (release = r));
      },
      { timeout: 30_000 },
    );
    await lockTaken;

    try {
      const res = await scheduler.runOnce(NOW);
      expect(res.locked).toBe(false);
      expect(sendCareReminder).not.toHaveBeenCalled();
      expect(sendToUser).not.toHaveBeenCalled();
      const after = await prisma.notificationEvent.findUnique({
        where: { id: ev.id },
      });
      expect(after?.notifiedAt).toBeNull();
    } finally {
      release();
      await holder;
    }
  });

  it('sends one localized e-mail for a due event and sets notifiedAt; a rerun sends no duplicate', async () => {
    const user = await createUser('email', {
      locale: 'en',
      timezone: 'America/New_York',
    });
    const ev = await createDueEvent(user.id);

    const first = await scheduler.runOnce(NOW);
    expect(first.locked).toBe(true);
    expect(mailsTo(user.email)).toHaveLength(1);
    const [, locale, data] = mailsTo(user.email)[0];
    expect(locale).toBe('en');
    expect(data).toMatchObject({
      label: 'Vermifuge',
      timezone: 'America/New_York',
    });
    expect(pushesTo(user.id)).toHaveLength(0);

    const after = await prisma.notificationEvent.findUnique({
      where: { id: ev.id },
    });
    expect(after?.notifiedAt?.getTime()).toBe(NOW.getTime());

    const second = await scheduler.runOnce(new Date(NOW.getTime() + 60_000));
    expect(second.locked).toBe(true);
    expect(mailsTo(user.email)).toHaveLength(1);
  });

  it('push-only channel: no e-mail, one push', async () => {
    const user = await createUser('push');
    const ev = await createDueEvent(user.id);

    await scheduler.runOnce(NOW);

    expect(mailsTo(user.email)).toHaveLength(0);
    expect(pushesTo(user.id)).toHaveLength(1);
    expect(pushesTo(user.id)[0][1].data?.eventId).toBe(ev.id);
    const after = await prisma.notificationEvent.findUnique({
      where: { id: ev.id },
    });
    expect(after?.notifiedAt).not.toBeNull();
  });

  it('"both" sends e-mail and push; ignores events outside the window or already handled', async () => {
    const user = await createUser('both');
    const due = await createDueEvent(user.id);
    const tooOld = await createDueEvent(
      user.id,
      new Date(NOW.getTime() - 11 * 60_000),
    );
    const future = await createDueEvent(
      user.id,
      new Date(NOW.getTime() + 60_000),
    );
    const done = await createDueEvent(user.id);
    await prisma.notificationEvent.update({
      where: { id: done.id },
      data: { status: 'done' },
    });

    await scheduler.runOnce(NOW);

    expect(mailsTo(user.email)).toHaveLength(1);
    expect(pushesTo(user.id)).toHaveLength(1);
    const rows = await prisma.notificationEvent.findMany({
      where: { id: { in: [due.id, tooOld.id, future.id, done.id] } },
    });
    const notified = rows.filter((r) => r.notifiedAt).map((r) => r.id);
    expect(notified).toEqual([due.id]);
  });

  it('releases the claim when every channel fails, so the next tick retries', async () => {
    const user = await createUser('email');
    const ev = await createDueEvent(user.id);
    sendCareReminder.mockResolvedValueOnce({
      sent: false,
      simulated: false,
      attempts: 3,
    });

    const first = await scheduler.runOnce(NOW);
    expect(first.failed).toBeGreaterThanOrEqual(1);
    let row = await prisma.notificationEvent.findUnique({
      where: { id: ev.id },
    });
    expect(row?.notifiedAt).toBeNull();

    await scheduler.runOnce(new Date(NOW.getTime() + 5 * 60_000));
    expect(mailsTo(user.email)).toHaveLength(2);
    row = await prisma.notificationEvent.findUnique({ where: { id: ev.id } });
    expect(row?.notifiedAt).not.toBeNull();
  });

  it('generates today events (user timezone) from routines, then notifies them', async () => {
    const user = await createUser('email', { timezone: 'Europe/Paris' });
    const species = await prisma.speciesProfile.findFirstOrThrow({
      select: { speciesId: true },
    });
    const animal = await prisma.animal.create({
      data: { userId: user.id, speciesId: species.speciesId, name: 'Rex' },
    });
    await prisma.routine.create({
      data: {
        animalId: animal.id,
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '08:00', recurrence: 'daily' },
      },
    });

    const res = await scheduler.runOnce(NOW);
    expect(res.generated).toBeGreaterThanOrEqual(1);

    const events = await prisma.notificationEvent.findMany({
      where: { userId: user.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].scheduledAt.toISOString()).toBe(
      '2031-03-10T08:00:00.000Z',
    );
    expect(events[0].notifiedAt).not.toBeNull();
    expect(mailsTo(user.email)).toHaveLength(1);
    expect(mailsTo(user.email)[0][2]).toMatchObject({ animalName: 'Rex' });
  });

  it('is disabled in tests and when REMINDERS_ENABLED=false', async () => {
    const spy = jest.spyOn(scheduler, 'runOnce');
    expect(scheduler.enabled).toBe(false); // NODE_ENV=test
    await scheduler.handleCron();
    expect(spy).not.toHaveBeenCalled();

    const prev = {
      env: process.env.NODE_ENV,
      flag: process.env.REMINDERS_ENABLED,
    };
    process.env.NODE_ENV = 'development';
    process.env.REMINDERS_ENABLED = 'false';
    expect(scheduler.enabled).toBe(false);
    process.env.REMINDERS_ENABLED = 'true';
    expect(scheduler.enabled).toBe(true);
    process.env.NODE_ENV = prev.env;
    if (prev.flag === undefined) delete process.env.REMINDERS_ENABLED;
    else process.env.REMINDERS_ENABLED = prev.flag;
  });
});
