import { GradeService } from './grade.service';
import { AgendaService } from '../agenda/agenda.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RoutinesService } from '../routines/routines.service';
import { addDays } from '../common/timezone';

/**
 * Rappels serveur des médicaments et routines (`NotificationEvent`) : mêmes instants que
 * l'Agenda (et donc que les rappels locaux de l'app). Prisma simulé, aucune base requise.
 * Fuseau Europe/Paris ; passage à l'heure d'hiver le dimanche 25/10/2026.
 */
const animal = { id: 'a1', name: 'Rex' };

interface Fixtures {
  medications?: Record<string, unknown>[];
  routines?: Record<string, unknown>[];
}

const medication = (id: string, over: Record<string, unknown>) => ({
  id,
  animalId: animal.id,
  animal,
  name: id,
  dose: '1 ml',
  unit: null,
  notes: null,
  frequency: 'daily',
  intervalHours: null,
  startDate: new Date('2026-10-21T00:00:00Z'), // mercredi
  endDate: null,
  active: true,
  ...over,
});

const routine = (id: string, over: Record<string, unknown>) => ({
  id,
  animalId: animal.id,
  animal,
  name: id,
  type: 'nourrissage',
  frequency: 'daily',
  active: true,
  schedule: { time: '08:00', recurrence: 'daily' },
  createdAt: new Date('2026-10-01T10:00:00Z'),
  ...over,
});

/** Événements générés par `GradeService` pour le jour local `day` (rien de préexistant). */
async function eventsOn(
  f: Fixtures,
  day: string,
): Promise<{ sourceKey: string; scheduledAt: Date }[]> {
  let created: { sourceKey: string; scheduledAt: Date }[] = [];
  const prisma = {
    user: {
      findUnique: () => Promise.resolve({ timezone: 'Europe/Paris' }),
    },
    notificationEvent: {
      findMany: () =>
        Promise.resolve(
          created
            .map((e, i) => ({ id: `e${i}`, status: 'pending', ...e }))
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
        ),
      createMany: ({
        data,
      }: {
        data: { sourceKey: string; scheduledAt: Date }[];
      }) => {
        created = data;
        return Promise.resolve({ count: data.length });
      },
      count: () => Promise.resolve(0),
      deleteMany: () => Promise.resolve({ count: 0 }),
    },
    notificationPreference: { findUnique: () => Promise.resolve(null) },
    medication: { findMany: () => Promise.resolve(f.medications ?? []) },
    vetAppointment: { findMany: () => Promise.resolve([]) },
    vaccination: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;
  const routines = {
    getActiveRoutines: () => Promise.resolve(f.routines ?? []),
  } as unknown as RoutinesService;
  await new GradeService(prisma, routines).getOrCreateTodayEvents('u1', day);
  return created;
}

const keys = (evs: { sourceKey: string; scheduledAt: Date }[]) =>
  evs.map((e) => `${e.sourceKey}@${e.scheduledAt.toISOString()}`).sort();

describe('GradeService — rappels de médicaments', () => {
  it('hebdomadaire : rappel UNIQUEMENT le jour de la semaine du début, à 08:00 locale', async () => {
    const f = { medications: [medication('m1', { frequency: 'weekly' })] };
    const byDay: Record<string, string[]> = {};
    for (let i = 0; i < 15; i++) {
      const day = addDays('2026-10-21', i);
      byDay[day] = keys(await eventsOn(f, day));
    }
    expect(Object.entries(byDay).filter(([, k]) => k.length > 0)).toEqual([
      ['2026-10-21', ['medication:m1@2026-10-21T06:00:00.000Z']], // 08:00 CEST
      ['2026-10-28', ['medication:m1@2026-10-28T07:00:00.000Z']], // 08:00 CET
      ['2026-11-04', ['medication:m1@2026-11-04T07:00:00.000Z']],
    ]);
  });

  it('quotidien : un rappel à 08:00 locale, bornes [début ; fin] incluses', async () => {
    const f = {
      medications: [
        medication('m1', { endDate: new Date('2026-10-25T00:00:00Z') }),
      ],
    };
    expect(keys(await eventsOn(f, '2026-10-20'))).toEqual([]);
    expect(keys(await eventsOn(f, '2026-10-25'))).toEqual([
      'medication:m1@2026-10-25T07:00:00.000Z',
    ]);
    expect(keys(await eventsOn(f, '2026-10-26'))).toEqual([]);
  });

  it('toutes les N heures : un rappel par prise (et non plus un seul à 08:00)', async () => {
    const f = {
      medications: [
        medication('m1', { frequency: 'every_x_hours', intervalHours: 8 }),
      ],
    };
    expect(keys(await eventsOn(f, '2026-10-22'))).toEqual([
      'medication:m1@2026-10-21T22:00:00.000Z', // 00:00 locale
      'medication:m1@2026-10-22T06:00:00.000Z', // 08:00
      'medication:m1@2026-10-22T14:00:00.000Z', // 16:00
    ]);
  });

  it('médicament inactif : aucun rappel', async () => {
    const f = { medications: [medication('m1', { active: false })] };
    expect(await eventsOn(f, '2026-10-22')).toEqual([]);
  });
});

describe('GradeService — même source de vérité que l’Agenda', () => {
  const fixtures: Fixtures = {
    medications: [
      medication('daily', {}),
      medication('weekly', { frequency: 'weekly' }),
      medication('weekly-sun', {
        frequency: 'weekly',
        startDate: new Date('2026-10-25T00:00:00Z'),
        endDate: new Date('2026-11-08T00:00:00Z'),
      }),
      medication('every-5h', { frequency: 'every_x_hours', intervalHours: 5 }),
      medication('every-24h', {
        frequency: 'every_x_hours',
        intervalHours: 24,
      }),
    ],
    routines: [
      routine('r-daily', {}),
      routine('r-new', {
        schedule: { time: '02:30', recurrence: 'daily' },
        createdAt: new Date('2026-10-24T09:00:00Z'),
      }),
      routine('r-weekly', {
        schedule: { time: '19:00', recurrence: 'weekly', weekDay: 0 },
      }),
      routine('r-2d', {
        schedule: { time: '07:15', recurrence: 'every_2_days' },
      }),
      routine('r-3d', {
        frequency: 'every_3_days',
        schedule: { time: '21:00' },
      }),
      routine('r-month', {
        schedule: { time: '10:00', recurrence: 'monthly', dayOfMonth: 1 },
      }),
      routine('r-hourly', {
        schedule: { time: '00:00', recurrence: 'hourly', intervalHours: 5 },
      }),
    ],
  };

  it.each([
    ['passage à l’heure d’hiver', '2026-10-15', '2026-11-08'],
    ['passage à l’heure d’été', '2027-03-20', '2027-04-05'],
  ])(
    '%s : instants des rappels serveur = instants de l’Agenda',
    async (_label, from, to) => {
      const prisma = {
        user: {
          findUnique: () =>
            Promise.resolve({ locale: 'fr', timezone: 'Europe/Paris' }),
        },
        routine: { findMany: () => Promise.resolve(fixtures.routines) },
        medication: { findMany: () => Promise.resolve(fixtures.medications) },
        vaccination: { findMany: () => Promise.resolve([]) },
        vetAppointment: { findMany: () => Promise.resolve([]) },
        notificationEvent: { findMany: () => Promise.resolve([]) },
      } as unknown as PrismaService;
      const agenda = await new AgendaService(prisma).getAgenda(
        'u1',
        from,
        to,
        new Date(`${from}T12:00:00Z`),
      );
      expect(agenda.truncated).toBe(false);
      const fromAgenda = agenda.items
        .map((i) => `${i.type}:${i.sourceId}@${i.date}`)
        .sort();

      const fromReminders: string[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        fromReminders.push(...keys(await eventsOn(fixtures, d)));
      }
      expect(fromReminders.sort()).toEqual(fromAgenda);
      // Garde-fous : la fenêtre contient bien chaque source.
      for (const id of ['weekly', 'every-5h', 'r-new', 'r-3d', 'r-month']) {
        expect(fromAgenda.some((k) => k.includes(`:${id}@`))).toBe(true);
      }
    },
  );
});
