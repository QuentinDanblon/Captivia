import { AgendaService, MAX_AGENDA_ITEMS } from './agenda.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Non-régression (revue de sécurité, constats 4 et 5), d'après les tests de démonstration du
 * relecteur (agenda-tz.spec.ts, agenda-buffer.spec.ts) : Prisma simulé, aucune base requise.
 */
const NOW = new Date('2026-10-02T10:00:00Z');
const animal = { id: 'a1', name: 'Rex' };
const createdAt = new Date('2026-01-01T00:00:00Z');

interface Fixtures {
  timezone?: string | null;
  routines?: unknown[];
  medications?: unknown[];
  vaccinations?: unknown[];
  appointments?: unknown[];
}

function serviceWith(f: Fixtures): AgendaService {
  const user = {
    id: 'u1',
    locale: 'fr',
    timezone: f.timezone === undefined ? 'Europe/Paris' : f.timezone,
  };
  const prisma = {
    user: { findUnique: () => Promise.resolve(user) },
    routine: { findMany: () => Promise.resolve(f.routines ?? []) },
    medication: { findMany: () => Promise.resolve(f.medications ?? []) },
    vaccination: { findMany: () => Promise.resolve(f.vaccinations ?? []) },
    vetAppointment: {
      findMany: () => Promise.resolve(f.appointments ?? []),
    },
    notificationEvent: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;
  return new AgendaService(prisma);
}

const routine = (id: string, schedule: Record<string, unknown>, name = id) => ({
  id,
  name,
  type: 'nourrissage',
  frequency: schedule.recurrence ?? 'daily',
  active: true,
  schedule,
  createdAt,
  animal,
});

/** Heure murale à Paris (Intl, indépendant du code testé). */
const parisTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

describe('AgendaService — fuseau de l’utilisateur (constat 4)', () => {
  it('routine « 08:00 » et « 23:30 » d’un utilisateur Europe/Paris : heures murales et jour J', async () => {
    const svc = serviceWith({
      routines: [
        routine('r1', { time: '08:00', recurrence: 'daily' }, 'Nourrissage'),
        routine('r2', { time: '23:30', recurrence: 'daily' }, 'Lampe off'),
      ],
    });
    const res = await svc.getAgenda('u1', '2026-10-03', '2026-10-03', NOW);
    expect(res.items.map((i) => [i.title, i.date, i.day])).toEqual([
      ['Nourrissage', '2026-10-03T06:00:00.000Z', '2026-10-03'],
      ['Lampe off', '2026-10-03T21:30:00.000Z', '2026-10-03'],
    ]);
    for (const i of res.items) {
      expect(parisTime(i.date)).toBe(
        i.title === 'Nourrissage' ? '08:00' : '23:30',
      );
    }
  });

  it('« aujourd’hui » par défaut = jour local (23:30Z le 2 oct. = 3 oct. à Paris)', async () => {
    const svc = serviceWith({});
    const late = new Date('2026-10-02T23:30:00Z');
    expect((await svc.getAgenda('u1', undefined, undefined, late)).from).toBe(
      '2026-10-03',
    );
    const utcUser = serviceWith({ timezone: 'UTC' });
    expect(
      (await utcUser.getAgenda('u1', undefined, undefined, late)).from,
    ).toBe('2026-10-02');
  });

  it('fuseau absent : Europe/Paris par défaut', async () => {
    const svc = serviceWith({
      timezone: null,
      routines: [routine('r1', { time: '08:00', recurrence: 'daily' })],
    });
    const res = await svc.getAgenda('u1', '2026-01-15', '2026-01-15', NOW);
    expect(res.items[0].date).toBe('2026-01-15T07:00:00.000Z');
  });

  it('médicament (08:00 locale) et RDV (jour local de l’instant)', async () => {
    const svc = serviceWith({
      medications: [
        {
          id: 'm1',
          name: 'Amox',
          dose: '2',
          unit: 'ml',
          frequency: 'daily',
          intervalHours: null,
          startDate: new Date('2026-10-03T00:00:00Z'),
          endDate: new Date('2026-10-03T00:00:00Z'),
          notes: null,
          animal,
        },
      ],
      appointments: [
        {
          id: 'v1',
          // 22:30Z le 3 = 00:30 le 4 à Paris
          date: new Date('2026-10-03T22:30:00Z'),
          status: 'scheduled',
          vetName: 'Dr Nuit',
          reason: null,
          location: null,
          animal,
        },
      ],
    });
    const res = await svc.getAgenda('u1', '2026-10-03', '2026-10-04', NOW);
    const med = res.items.find((i) => i.type === 'medication');
    expect(med).toMatchObject({
      date: '2026-10-03T06:00:00.000Z',
      day: '2026-10-03',
    });
    const vet = res.items.find((i) => i.type === 'vet_appointment');
    expect(vet).toMatchObject({ day: '2026-10-04' });
  });
});

describe('AgendaService — le tampon n’efface plus les sources (constat 5)', () => {
  const hourly = Array.from({ length: 5 }, (_, i) =>
    routine(
      `r${i}`,
      { time: '00:00', recurrence: 'hourly', intervalHours: 1 },
      `Brumisation ${i}`,
    ),
  );
  const vet = {
    id: 'v1',
    date: new Date('2026-10-03T09:00:00Z'),
    status: 'scheduled',
    vetName: 'Dr Vet',
    reason: 'Contrôle',
    location: null,
    animal,
  };
  const farVet = {
    ...vet,
    id: 'v2',
    vetName: 'Dr Loin',
    date: new Date('2026-12-20T09:00:00Z'),
  };
  const vaccine = {
    id: 'vac1',
    name: 'Rage',
    notes: null,
    nextDueDate: new Date('2026-12-15T00:00:00Z'),
    animal,
  };

  it('5 routines horaires + RDV sur 92 jours : RDV présents dans le JSON et dans l’ICS', async () => {
    const svc = serviceWith({
      routines: hourly,
      appointments: [vet, farVet],
      vaccinations: [vaccine],
    });
    const res = await svc.getAgenda('u1', '2026-10-02', '2027-01-01', NOW);
    expect(res.truncated).toBe(true);
    expect(res.items).toHaveLength(MAX_AGENDA_ITEMS);
    const titles = res.items.map((i) => i.title);
    expect(titles).toContain('Dr Vet');
    expect(titles).toContain('Dr Loin');
    expect(titles).toContain('Rage');
    const dates = res.items.map((i) => i.date);
    expect([...dates].sort()).toEqual(dates);

    const ics = await svc.getFeedByToken('A'.repeat(43), NOW);
    expect(ics).toContain('Dr Vet');
    expect(ics).toContain('Dr Loin');
    expect(ics).toContain('Rage');
  });

  it('sur 30 jours aussi, et sans troncature quand tout tient', async () => {
    const svc = serviceWith({
      routines: hourly.slice(0, 1),
      appointments: [vet],
    });
    const res = await svc.getAgenda('u1', '2026-10-02', undefined, NOW);
    expect(res.truncated).toBe(false);
    expect(res.items.filter((i) => i.type === 'vet_appointment')).toHaveLength(
      1,
    );
    // 1 routine horaire × 24 × 30 jours : la grille suit les heures murales 0–23 h, y compris le
    // 25 octobre (jour de 25 h : l'heure répétée n'est comptée qu'une fois).
    expect(res.items.filter((i) => i.type === 'routine')).toHaveLength(24 * 30);
  });
});
