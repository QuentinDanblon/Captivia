/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
// supertest renvoie des corps `any` : règles unsafe-* désactivées pour ce fichier de test.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_EVENTS_PER_DAY } from '../src/grade/grade.service';

/**
 * W0-07 — DoS des notifications et farming de points :
 * DTO imbriqués, plafond d'événements, refresh limité aux pending, crédit de points atomique.
 */
describe('Notification events hardening (W0-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  let token: string;
  let userId: string;
  let animalId: string;
  const today = new Date().toISOString().slice(0, 10);

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const patchPrefs = (body: unknown) =>
    request(app.getHttpServer())
      .patch('/users/me/notification-preferences')
      .set(auth())
      .send(body as object);
  const getEvents = (qs = '') =>
    request(app.getHttpServer())
      .get(`/users/me/notification-events${qs}`)
      .set(auth());

  beforeAll(async () => {
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

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `evt-hardening-${stamp}@captivia.com`,
        password: 'password123',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    token = reg.body.accessToken;
    userId = reg.body.user.id;

    const animal = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set(auth())
      .send({ speciesId: 5221172, name: 'Eventful' })
      .expect(201);
    animalId = animal.body.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.notificationEvent.deleteMany({ where: { userId } });
      await prisma.animal.deleteMany({ where: { userId } });
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    if (app) await app.close();
  });

  describe('notification preferences DTO', () => {
    it('rejects an out-of-range time ("-100000000:00") with 400', async () => {
      await patchPrefs({
        types: { Nourrissage: true },
        typeSchedules: {
          Nourrissage: { time: '-100000000:00', recurrence: 'daily' },
        },
      }).expect(400);
    });

    it.each([
      ['24:00', { time: '24:00', recurrence: 'daily' }],
      ['8:00 (1 digit)', { time: '8:00', recurrence: 'daily' }],
      ['unknown recurrence', { time: '08:00', recurrence: 'every_minute' }],
      [
        'intervalHours 0',
        { time: '08:00', recurrence: 'hourly', intervalHours: 0 },
      ],
      [
        'intervalHours 25',
        { time: '08:00', recurrence: 'hourly', intervalHours: 25 },
      ],
      [
        'intervalHours 1000000',
        { time: '08:00', recurrence: 'hourly', intervalHours: 1000000 },
      ],
      ['weekDay 7', { time: '08:00', recurrence: 'weekly', weekDay: 7 }],
      [
        'dayOfMonth 32',
        { time: '08:00', recurrence: 'monthly', dayOfMonth: 32 },
      ],
      ['bad date', { time: '08:00', recurrence: 'once', date: 'tomorrow' }],
      ['time as number', { time: 800, recurrence: 'daily' }],
      ['unknown property', { time: '08:00', recurrence: 'daily', evil: 'x' }],
    ])('rejects a typeSchedule with %s', async (_label, schedule) => {
      // les propriétés inconnues sont retirées (pick) : seul le cas "unknown property" doit passer
      const res = await patchPrefs({
        types: { Bain: true },
        typeSchedules: { Bain: schedule },
      });
      if (_label === 'unknown property') {
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body.typeSchedules)).not.toContain('evil');
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('rejects an invalid global window and non-boolean types', async () => {
      await patchPrefs({ schedule: { start: '99:99', end: '22:00' } }).expect(
        400,
      );
      await patchPrefs({ schedule: 'x' }).expect(400);
      await patchPrefs({ types: { Bain: 'yes' } }).expect(400);
      await patchPrefs({ types: [] }).expect(400);
      await patchPrefs({ typeSchedules: { Bain: 'x' } }).expect(400);
    });

    it('rejects too many types and oversized keys', async () => {
      const many: Record<string, boolean> = {};
      for (let i = 0; i < 51; i++) many[`type-${i}`] = true;
      await patchPrefs({ types: many }).expect(400);
      await patchPrefs({ types: { ['k'.repeat(61)]: true } }).expect(400);
    });

    it('accepts a payload shaped like the frontend sends', async () => {
      const res = await patchPrefs({
        types: { Nourrissage: true, 'Rappel véto': false },
        typeSchedules: {
          Nourrissage: { time: '08:00', recurrence: 'daily' },
          'Rappel véto': { time: '18:30', recurrence: 'weekly', weekDay: 3 },
          Bain: { time: '07:15', recurrence: 'hourly', intervalHours: 4 },
          Soin: { time: '09:00', recurrence: 'once', date: '2026-10-05' },
          Brosse: { time: '09:00', recurrence: 'monthly', dayOfMonth: 15 },
        },
        schedule: { start: '08:00', end: '22:00' },
        snooze: 15,
        deliveryChannel: 'push',
      }).expect(200);
      expect(res.body.typeSchedules.Nourrissage.time).toBe('08:00');
      expect(res.body.schedule).toEqual({ start: '08:00', end: '22:00' });
    });
  });

  describe('notification-events query', () => {
    it('validates date (ISO day within [D-1; D+366]) and refresh', async () => {
      await getEvents('?date=1999-01-01').expect(400);
      const daysAgo = (n: number) =>
        new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      await getEvents(`?date=${daysAgo(10)}`).expect(400);
      await getEvents(`?date=${daysAgo(366)}`).expect(400);
      await getEvents(`?date=${daysAgo(1)}`).expect(200);
      await getEvents('?date=2999-01-01').expect(400);
      await getEvents('?date=2026-02-31').expect(400);
      await getEvents('?date=not-a-date').expect(400);
      await getEvents(`?date=${today}T00:00:00Z`).expect(400);
      await getEvents('?refresh=maybe').expect(400);
      await getEvents('?foo=bar').expect(400);
      await getEvents(`?date=${today}&refresh=true`).expect(200);
      await getEvents().expect(200);
    });

    it('rejects an invalid status body', async () => {
      await request(app.getHttpServer())
        .patch('/users/me/notification-events/some-id')
        .set(auth())
        .send({ status: 'hacked' })
        .expect(400);
    });
  });

  describe('event generation bounds', () => {
    beforeEach(async () => {
      await prisma.notificationEvent.deleteMany({ where: { userId } });
    });

    it('creates at most 24 events for an hourly type and is idempotent', async () => {
      await patchPrefs({
        types: { Hydratation: true },
        typeSchedules: {
          Hydratation: {
            time: '00:00',
            recurrence: 'hourly',
            intervalHours: 1,
          },
        },
      }).expect(200);
      const first = await getEvents(`?date=${today}`).expect(200);
      const hydr = first.body.filter(
        (e: { type: string }) => e.type === 'Hydratation',
      );
      expect(hydr).toHaveLength(24);

      // appels parallèles : aucun doublon (index unique + skipDuplicates)
      await Promise.all(
        [1, 2, 3].map(() =>
          getEvents(`?date=${today}&refresh=true`).expect(200),
        ),
      );
      const count = await prisma.notificationEvent.count({
        where: { userId, type: 'Hydratation' },
      });
      expect(count).toBe(24);
    });

    it(`caps the day at ${MAX_EVENTS_PER_DAY} events per user`, async () => {
      const types: Record<string, boolean> = {};
      const typeSchedules: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        types[`T${i}`] = true;
        typeSchedules[`T${i}`] = {
          time: '00:00',
          recurrence: 'hourly',
          intervalHours: 1,
        };
      }
      await patchPrefs({ types, typeSchedules }).expect(200); // 50 × 24 = 1200 candidats
      const res = await getEvents(`?date=${today}&refresh=true`).expect(200);
      expect(res.body.length).toBeLessThanOrEqual(MAX_EVENTS_PER_DAY);
      const count = await prisma.notificationEvent.count({ where: { userId } });
      expect(count).toBeLessThanOrEqual(MAX_EVENTS_PER_DAY);
    });

    it('ignores out-of-range values stored in a routine schedule (no explosion)', async () => {
      await prisma.notificationPreference.deleteMany({ where: { userId } });
      await prisma.routine.create({
        data: {
          animalId,
          type: 'nourrissage',
          frequency: 'hourly',
          schedule: {
            time: '-100000000:00',
            recurrence: 'hourly',
            intervalHours: -5,
          },
        },
      });
      const res = await getEvents(`?date=${today}`).expect(200);
      expect(res.body.length).toBeLessThanOrEqual(MAX_EVENTS_PER_DAY);
      await prisma.routine.deleteMany({ where: { animalId } });
    });
  });

  describe('points: atomic credit and refresh', () => {
    let routineId: string;

    beforeAll(async () => {
      await prisma.notificationEvent.deleteMany({ where: { userId } });
      await prisma.notificationPreference.deleteMany({ where: { userId } });
      await prisma.routine.deleteMany({ where: { animalId } });
      const routine = await prisma.routine.create({
        data: {
          animalId,
          type: 'nourrissage',
          frequency: 'daily',
          schedule: { time: '06:00', recurrence: 'daily' },
        },
      });
      routineId = routine.id;
    });

    it('credits points once when "done" is sent twice in parallel', async () => {
      const list = await getEvents(`?date=${today}`).expect(200);
      const ev = list.body.find(
        (e: { routineId?: string }) => e.routineId === routineId,
      );
      expect(ev).toBeDefined();

      const before = await prisma.user.findUnique({ where: { id: userId } });
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .patch(`/users/me/notification-events/${ev.id}`)
            .set(auth())
            .send({ status: 'done' }),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 404)).toHaveLength(4);

      const after = await prisma.user.findUnique({ where: { id: userId } });
      expect(after!.points - before!.points).toBe(2);
    });

    it('refresh keeps the done event and does not recreate it (no re-credit)', async () => {
      const pointsBefore = (await prisma.user.findUnique({
        where: { id: userId },
      }))!.points;

      const res = await getEvents(`?date=${today}&refresh=true`).expect(200);
      const mine = res.body.filter(
        (e: { routineId?: string }) => e.routineId === routineId,
      );
      expect(mine).toHaveLength(1);
      expect(mine[0].status).toBe('done');
      expect(mine[0].pointsAwarded).toBe(2);

      // impossible de le refaire
      await request(app.getHttpServer())
        .patch(`/users/me/notification-events/${mine[0].id}`)
        .set(auth())
        .send({ status: 'done' })
        .expect(404);

      expect(
        (await prisma.user.findUnique({ where: { id: userId } }))!.points,
      ).toBe(pointsBefore);
    });

    it('a done event cannot be deleted then regenerated to farm points', async () => {
      const list = await getEvents(`?date=${today}`).expect(200);
      const done = list.body.find(
        (e: { status: string }) => e.status === 'done',
      );
      expect(done).toBeDefined();
      await request(app.getHttpServer())
        .delete(`/users/me/notification-events/${done.id}`)
        .set(auth())
        .expect(404);
    });

    it('refresh still removes and regenerates pending events', async () => {
      await prisma.notificationEvent.deleteMany({ where: { userId } });
      const first = await getEvents(`?date=${today}`).expect(200);
      const pendingId = first.body.find(
        (e: { routineId?: string }) => e.routineId === routineId,
      ).id;
      const second = await getEvents(`?date=${today}&refresh=true`).expect(200);
      const regenerated = second.body.find(
        (e: { routineId?: string }) => e.routineId === routineId,
      );
      expect(regenerated.status).toBe('pending');
      expect(regenerated.id).not.toBe(pendingId);
    });

    it('lets a backdated event (3 days ago) be marked done without points', async () => {
      const created = await prisma.notificationEvent.create({
        data: {
          userId,
          type: 'Nourrissage',
          label: 'Backdated',
          scheduledAt: new Date(Date.now() - 3 * 86400000),
          routineId,
          animalId,
        },
      });
      const before = (await prisma.user.findUnique({ where: { id: userId } }))!
        .points;
      const res = await request(app.getHttpServer())
        .patch(`/users/me/notification-events/${created.id}`)
        .set(auth())
        .send({ status: 'done' })
        .expect(200);
      expect(res.body.event.status).toBe('done');
      expect(res.body.event.pointsAwarded).toBe(0);
      expect(
        (await prisma.user.findUnique({ where: { id: userId } }))!.points,
      ).toBe(before);
    });

    it('does not credit points for an event more than a day in the future', async () => {
      const future = new Date(Date.now() + 5 * 86400000)
        .toISOString()
        .slice(0, 10);
      const list = await getEvents(`?date=${future}`).expect(200);
      const ev = list.body.find(
        (e: { routineId?: string }) => e.routineId === routineId,
      );
      const before = (await prisma.user.findUnique({ where: { id: userId } }))!
        .points;
      const res = await request(app.getHttpServer())
        .patch(`/users/me/notification-events/${ev.id}`)
        .set(auth())
        .send({ status: 'done' })
        .expect(200);
      expect(res.body.event.pointsAwarded).toBe(0);
      expect(
        (await prisma.user.findUnique({ where: { id: userId } }))!.points,
      ).toBe(before);
    });
  });
});
