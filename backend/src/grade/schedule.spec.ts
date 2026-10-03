import {
  matchesSchedule,
  normalizeSchedule,
  scheduleOccurrences,
} from '../common/care-occurrences';
import { addDays, makeLocalTimeResolver } from '../common/timezone';

/** Revue de sécurité, constat 4 : récurrences sur le jour LOCAL, ancrées, et heures locales. */
const days = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(from, i));

describe('matchesSchedule — every_2_days / every_3_days', () => {
  it.each([
    ['every_2_days', 2],
    ['every_3_days', 3],
  ])(
    '%s : première occurrence le jour d’ancrage, puis tous les %i jours (aucune dérive)',
    (recurrence, period) => {
      const anchor = '2026-10-03'; // jour local de création
      const matched = days('2026-09-28', 60).filter((d) =>
        matchesSchedule({ time: '08:00', recurrence }, d, anchor),
      );
      expect(matched[0]).toBe(anchor);
      for (let i = 1; i < matched.length; i++) {
        expect(addDays(matched[i - 1], period)).toBe(matched[i]);
      }
      // Rien avant le jour d'ancrage.
      expect(matched.every((d) => d >= anchor)).toBe(true);
    },
  );

  it('le rythme ne dépend pas de la parité epoch : deux routines créées à 1 jour d’écart sont décalées', () => {
    const a = days('2026-10-01', 10).filter((d) =>
      matchesSchedule({ recurrence: 'every_2_days' }, d, '2026-10-01'),
    );
    const b = days('2026-10-01', 10).filter((d) =>
      matchesSchedule({ recurrence: 'every_2_days' }, d, '2026-10-02'),
    );
    expect(a[0]).toBe('2026-10-01');
    expect(b[0]).toBe('2026-10-02');
    expect(a.some((d) => b.includes(d))).toBe(false);
  });

  it('`schedule.date` sert d’ancrage explicite', () => {
    expect(
      matchesSchedule(
        { recurrence: 'every_3_days', date: '2026-10-05' },
        '2026-10-08',
        '2026-10-01',
      ),
    ).toBe(true);
    expect(
      matchesSchedule(
        { recurrence: 'every_3_days', date: '2026-10-05' },
        '2026-10-07',
        '2026-10-01',
      ),
    ).toBe(false);
  });

  it('régularité à travers le changement d’heure (jours calendaires, pas d’instants)', () => {
    const matched = days('2026-03-27', 6).filter((d) =>
      matchesSchedule({ recurrence: 'every_2_days' }, d, '2026-03-27'),
    );
    expect(matched).toEqual(['2026-03-27', '2026-03-29', '2026-03-31']);
  });

  it('weekly / monthly / once évalués sur le jour local', () => {
    expect(
      matchesSchedule({ recurrence: 'weekly', weekDay: 0 }, '2026-03-29'),
    ).toBe(true);
    expect(
      matchesSchedule({ recurrence: 'weekly', weekDay: 0 }, '2026-03-30'),
    ).toBe(false);
    expect(
      matchesSchedule({ recurrence: 'monthly', dayOfMonth: 31 }, '2026-03-31'),
    ).toBe(true);
    expect(
      matchesSchedule({ recurrence: 'once', date: '2026-10-05' }, '2026-10-05'),
    ).toBe(true);
    expect(
      matchesSchedule({ recurrence: 'once', date: '2026-10-05' }, '2026-10-06'),
    ).toBe(false);
  });
});

describe('scheduleOccurrences — heures locales', () => {
  const paris = makeLocalTimeResolver('Europe/Paris');

  it('« 08:00 » à Paris : 06:00Z en été, 07:00Z en hiver', () => {
    const sch = normalizeSchedule({ time: '08:00', recurrence: 'daily' });
    expect(
      scheduleOccurrences(sch, 'daily', sch.time, '2026-07-15', paris).map(
        (d) => d.toISOString(),
      ),
    ).toEqual(['2026-07-15T06:00:00.000Z']);
    expect(
      scheduleOccurrences(sch, 'daily', sch.time, '2026-01-15', paris).map(
        (d) => d.toISOString(),
      ),
    ).toEqual(['2026-01-15T07:00:00.000Z']);
  });

  it('grille horaire le jour du passage à l’heure d’été : 23 instants distincts, sans doublon', () => {
    const sch = normalizeSchedule({
      time: '00:00',
      recurrence: 'hourly',
      intervalHours: 1,
    });
    const spring = scheduleOccurrences(
      sch,
      'hourly',
      sch.time,
      '2026-03-29',
      paris,
    );
    expect(spring).toHaveLength(23);
    expect(new Set(spring.map((d) => d.getTime())).size).toBe(23);
    const normal = scheduleOccurrences(
      sch,
      'hourly',
      sch.time,
      '2026-03-30',
      paris,
    );
    expect(normal).toHaveLength(24);
  });
});
