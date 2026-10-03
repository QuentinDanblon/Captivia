import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { GradeModule } from '../grade/grade.module';
import { GradeService } from '../grade/grade.service';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import {
  DISPATCH_CONCURRENCY,
  NotificationsSchedulerService,
  REMINDERS_LOCK_KEY,
  effectiveChannel,
  localDay,
  normalizeChannel,
} from './notifications-scheduler.service';
import { PUSH_SENDER, PushReminderPayload } from './push-sender';
import { NATIVE_PUSH_RUN_BUDGET_MS } from './native-push-sender';

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

  it('falls back to push for an account without e-mail (guest)', () => {
    expect(effectiveChannel('email', null)).toBe('push');
    expect(effectiveChannel('both', null)).toBe('push');
    expect(effectiveChannel('both', 'a@b.c')).toBe('both');
  });
});

/** Prisma réel sur la base de test (DATABASE_URL). */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('NotificationsSchedulerService (Prisma réel)', () => {
  let moduleRef: TestingModule;
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
    moduleRef = await Test.createTestingModule({
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
        // Jour local du 10 mars 2031 dans tous les fuseaux (de UTC+14 à UTC-12).
        scheduledAt: {
          gte: new Date('2031-03-09T00:00:00Z'),
          lt: new Date('2031-03-12T00:00:00Z'),
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

  const mailsTo = (email: string | null) =>
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

  it('W6-07 : seuls les rappels que l’app programme au même instant portent `localReminder` (RDV J-N et 08:00 du jour : jamais)', async () => {
    const user = await createUser('push', { timezone: 'UTC' });
    const animal = await prisma.animal.create({
      data: { userId: user.id, speciesId: 5221172, name: 'Kaa' },
    });
    // Tous générés à 08:00 (UTC) le 10/03/2031 ; NOW = 08:03 : tous dus.
    const routine = await prisma.routine.create({
      data: {
        animalId: animal.id,
        name: 'Brumisation',
        type: 'entretien',
        frequency: 'daily',
        schedule: { time: '08:00', recurrence: 'daily' },
        createdAt: new Date('2031-03-01T00:00:00Z'),
      },
    });
    const medication = await prisma.medication.create({
      data: {
        animalId: animal.id,
        name: 'Vermifuge',
        dose: '1',
        frequency: 'daily',
        startDate: new Date('2031-03-01T00:00:00Z'),
      },
    });
    // RDV le 13 à 14:00 avec rappel J-3 (aujourd'hui 08:00) ; RDV du jour à 15:00 (08:00).
    await prisma.vetAppointment.create({
      data: {
        animalId: animal.id,
        vetName: 'Dr Loin',
        date: new Date('2031-03-13T14:00:00Z'),
        reminderDays: [3],
      },
    });
    await prisma.vetAppointment.create({
      data: {
        animalId: animal.id,
        vetName: 'Dr Jour',
        date: new Date('2031-03-10T15:00:00Z'),
        reminderDays: [],
      },
    });
    // Type personnalisé (préférences) « Bain » à 08:00 : absent de l'Agenda.
    await prisma.notificationPreference.update({
      where: { userId: user.id },
      data: {
        types: { Bain: true },
        schedule: { start: '08:00', end: '23:59' },
      },
    });

    const before = Date.now();
    await scheduler.runOnce(NOW);
    const payloads = pushesTo(user.id).map((c) => c[1]);
    const byTitle = (title: string) => payloads.find((p) => p.title === title);
    expect(payloads).toHaveLength(5);

    const at8 = new Date('2031-03-10T08:00:00Z');
    expect(byTitle('Brumisation')?.localReminder).toEqual({
      at: at8,
      sourceUpdatedAt: routine.updatedAt,
    });
    expect(byTitle('💊 Vermifuge (1)')?.localReminder).toEqual({
      at: at8,
      sourceUpdatedAt: medication.updatedAt,
    });
    // L'app ne programme qu'une notification à l'heure du RDV : J-3 et 08:00 du jour partent.
    expect(byTitle('🔔 Dr Loin (J-3)')).not.toHaveProperty('localReminder');
    expect(byTitle('🏥 RDV Dr Jour')).not.toHaveProperty('localReminder');
    expect(byTitle('Bain')).not.toHaveProperty('localReminder');

    // Échéance du canal natif posée pour toute l'exécution.
    for (const p of payloads) {
      expect(p.nativeDeadline).toBeGreaterThanOrEqual(
        before + NATIVE_PUSH_RUN_BUDGET_MS,
      );
      expect(p.nativeDeadline).toBeLessThanOrEqual(
        Date.now() + NATIVE_PUSH_RUN_BUDGET_MS,
      );
    }
  });

  it('guest (no e-mail) with channel "both": push only, never an e-mail', async () => {
    const guest = await prisma.user.create({
      data: { isGuest: true, email: null, passwordHash: null },
    });
    userIds.push(guest.id);
    await prisma.notificationPreference.create({
      data: {
        userId: guest.id,
        types: {},
        schedule: { start: '00:00', end: '23:59' },
        deliveryChannel: 'both',
      },
    });
    await createDueEvent(guest.id);

    await scheduler.runOnce(NOW);

    expect(mailsTo(null)).toHaveLength(0);
    expect(pushesTo(guest.id)).toHaveLength(1);
  });

  it('push-only channel: no e-mail, one push', async () => {
    const user = await createUser('push');
    const ev = await createDueEvent(user.id);

    await scheduler.runOnce(NOW);

    expect(mailsTo(user.email)).toHaveLength(0);
    expect(pushesTo(user.id)).toHaveLength(1);
    expect(pushesTo(user.id)[0][1].data?.eventId).toBe(ev.id);
    // locale transmise au service worker pour le préfixe d'URL du clic
    expect(pushesTo(user.id)[0][1].data?.locale).toBe('fr');
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
        // Heure LOCALE (Paris, heure d'hiver UTC+1) : 09:00 → 08:00Z.
        schedule: { time: '09:00', recurrence: 'daily' },
      },
    });
    // Même instant UTC pour un utilisateur de New York (heure d'été depuis le 9 mars 2031, UTC-4).
    const ny = await createUser('email', { timezone: 'America/New_York' });
    const nyAnimal = await prisma.animal.create({
      data: { userId: ny.id, speciesId: species.speciesId, name: 'Milo' },
    });
    await prisma.routine.create({
      data: {
        animalId: nyAnimal.id,
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '04:00', recurrence: 'daily' },
      },
    });

    const res = await scheduler.runOnce(NOW);
    expect(res.generated).toBeGreaterThanOrEqual(2);

    for (const u of [user, ny]) {
      const events = await prisma.notificationEvent.findMany({
        where: { userId: u.id },
      });
      expect(events).toHaveLength(1);
      expect(events[0].scheduledAt.toISOString()).toBe(
        '2031-03-10T08:00:00.000Z',
      );
      expect(events[0].notifiedAt).not.toBeNull();
      expect(mailsTo(u.email)).toHaveLength(1);
    }
    expect(mailsTo(user.email)[0][2]).toMatchObject({ animalName: 'Rex' });
  });

  it('sends OUTSIDE the advisory-lock transaction: a slow push service no longer holds the lock', async () => {
    const user = await createUser('push');
    const ev = await createDueEvent(user.id);
    let lockFreeDuringSend: boolean | undefined;
    sendToUser.mockImplementation(async (userId) => {
      if (userId === user.id) {
        // Pendant l'envoi, une autre instance doit pouvoir prendre le verrou.
        lockFreeDuringSend = await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRawUnsafe<{ locked: boolean }[]>(
            `SELECT pg_try_advisory_xact_lock(${REMINDERS_LOCK_KEY}::bigint) AS locked`,
          );
          return rows[0]?.locked === true;
        });
      }
      return true;
    });

    const res = await scheduler.runOnce(NOW);

    expect(res.locked).toBe(true);
    expect(lockFreeDuringSend).toBe(true);
    const after = await prisma.notificationEvent.findUnique({
      where: { id: ev.id },
    });
    expect(after?.notifiedAt?.getTime()).toBe(NOW.getTime());
  });

  it(`sends in bounded batches (≤ ${DISPATCH_CONCURRENCY} in flight), each reminder exactly once, even with an overlapping run`, async () => {
    const user = await createUser('push');
    const events = await Promise.all(
      Array.from({ length: 25 }, () => createDueEvent(user.id)),
    );
    let inFlight = 0;
    let maxInFlight = 0;
    let overlapping: Promise<unknown> | undefined;
    // Seconde instance (même base) : elle obtient le verrou pendant les envois de la première,
    // mais ne doit rien renvoyer (les rappels sont déjà réservés).
    const other = new NotificationsSchedulerService(
      prisma,
      moduleRef.get(GradeService),
      mail,
      push,
    );
    sendToUser.mockImplementation(async (userId) => {
      if (userId !== user.id) return true;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      overlapping ??= other.runOnce(new Date(NOW.getTime() + 1_000));
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return true;
    });

    const res = await scheduler.runOnce(NOW);
    const second = (await overlapping) as { locked: boolean };

    expect(second.locked).toBe(true);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(DISPATCH_CONCURRENCY);
    expect(res.pushed).toBe(25);
    const sentIds = pushesTo(user.id).map((c) => c[1].data?.eventId);
    expect(sentIds).toHaveLength(25);
    expect(new Set(sentIds).size).toBe(25);
    expect(new Set(sentIds)).toEqual(new Set(events.map((e) => e.id)));
  });

  it('a throwing channel does not stop the batch; the failed reminder is released for a retry', async () => {
    const user = await createUser('email');
    const okUser = await createUser('email');
    const failing = await createDueEvent(user.id);
    const ok = await createDueEvent(okUser.id);
    sendCareReminder.mockImplementation((to: string) =>
      to === user.email
        ? Promise.reject(new Error('SMTP down'))
        : Promise.resolve({ sent: true, simulated: true, attempts: 1 }),
    );

    const res = await scheduler.runOnce(NOW);

    expect(res.failed).toBeGreaterThanOrEqual(1);
    const rows = await prisma.notificationEvent.findMany({
      where: { id: { in: [failing.id, ok.id] } },
    });
    const byId = new Map(rows.map((r) => [r.id, r.notifiedAt]));
    expect(byId.get(failing.id)).toBeNull();
    expect(byId.get(ok.id)).not.toBeNull();
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
