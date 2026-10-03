import {
  buildFeedUrl,
  agendaPeriodRange,
  filterPeriodItems,
  displayDay,
  distinctAnimals,
  filterItems,
  groupByDay,
  localDayKey,
  rangeFromToday,
  type AgendaItem,
} from '../agenda';
import { API_URL } from '../config';

const item = (over: Partial<AgendaItem> = {}): AgendaItem => ({
  id: 'routine:r1:2026-10-03T08:00:00.000Z',
  date: new Date(2026, 9, 3, 8, 0).toISOString(),
  day: '2026-10-03',
  allDay: false,
  type: 'routine',
  animalId: 'a1',
  animalName: 'Rex',
  title: 'Nourrissage',
  detail: null,
  status: 'pending',
  sourceId: 'r1',
  ...over,
});

describe('rangeFromToday', () => {
  it('couvre aujourd\'hui + N jours (bornes incluses, jour local)', () => {
    const now = new Date(2026, 9, 2, 23, 30);
    expect(rangeFromToday(7, now)).toEqual({ from: '2026-10-02', to: '2026-10-08' });
    expect(rangeFromToday(92, new Date(2026, 9, 1))).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });

  it('formate le jour local sur deux chiffres', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('filterItems', () => {
  const items = [
    item({ id: '1', animalId: 'a1', type: 'routine' }),
    item({ id: '2', animalId: 'a2', animalName: 'Milo', type: 'medication' }),
    item({ id: '3', animalId: 'a2', animalName: 'Milo', type: 'vaccination' }),
  ];

  it('ne filtre pas sans critère', () => {
    expect(filterItems(items, { animalId: '', type: '' })).toHaveLength(3);
  });

  it('filtre par animal, par type, ou les deux', () => {
    expect(filterItems(items, { animalId: 'a2', type: '' }).map((i) => i.id)).toEqual(['2', '3']);
    expect(filterItems(items, { animalId: '', type: 'routine' }).map((i) => i.id)).toEqual(['1']);
    expect(filterItems(items, { animalId: 'a2', type: 'vaccination' }).map((i) => i.id)).toEqual(['3']);
    expect(filterItems(items, { animalId: 'a1', type: 'vaccination' })).toEqual([]);
  });

  it('liste les animaux distincts par nom', () => {
    expect(distinctAnimals(items)).toEqual([
      { id: 'a2', name: 'Milo' },
      { id: 'a1', name: 'Rex' },
    ]);
  });
});

describe('groupByDay', () => {
  it('regroupe par jour, jours triés, journée entière en tête puis par heure', () => {
    const items = [
      item({ id: 'late', date: new Date(2026, 9, 3, 18, 0).toISOString() }),
      item({ id: 'next-day', date: new Date(2026, 9, 4, 8, 0).toISOString() }),
      item({ id: 'early', date: new Date(2026, 9, 3, 7, 0).toISOString() }),
      item({ id: 'vaccine', allDay: true, day: '2026-10-03', date: '2026-10-03T00:00:00.000Z', type: 'vaccination' }),
    ];
    const groups = groupByDay(items);
    expect(groups.map((g) => g.day)).toEqual(['2026-10-03', '2026-10-04']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['vaccine', 'early', 'late']);
  });

  it('utilise `day` pour une journée entière, même si le fuseau décalerait l\'instant', () => {
    const vaccine = item({ allDay: true, day: '2026-12-31', date: '2026-12-31T00:00:00.000Z' });
    expect(displayDay(vaccine)).toBe('2026-12-31');
  });

  it('renvoie une liste vide sans élément', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('buildFeedUrl', () => {
  it('préfixe le chemin du flux par l\'URL de l\'API', () => {
    expect(buildFeedUrl('/users/me/agenda.ics?token=abc')).toBe(`${API_URL}/users/me/agenda.ics?token=abc`);
  });
});


describe('agendaPeriodRange', () => {
  const now = new Date(2026, 9, 3, 23, 30);
  it.each([1, 24])('%i heures = durée exacte à partir de maintenant', (count) => {
    const range = agendaPeriodRange('hours', count, now);
    expect(range.start).toEqual(now);
    expect(range.end.getTime() - range.start.getTime()).toBe(count * 3_600_000);
    expect(range.from).toBe('2026-10-03');
    expect(range.to).toBe('2026-10-04');
  });
  it.each([1, 30])('%i jours incluent aujourd’hui', (count) => {
    const range = agendaPeriodRange('days', count, now);
    expect(range.from).toBe('2026-10-03');
    expect(range.to).toBe(count === 1 ? '2026-10-03' : '2026-11-01');
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(0);
  });
  it.each([
    [2026, 0, 31, 1, '2026-02-27'],
    [2028, 0, 31, 1, '2028-02-28'],
    [2027, 2, 1, 12, '2028-02-29'],
    [2028, 1, 29, 12, '2029-02-27'],
    [2026, 9, 3, 12, '2027-10-02'],
  ])('mois calendaires %i/%i/%i + %i', (year, month, day, count, to) => {
    expect(agendaPeriodRange('months', count, new Date(year, month, day)).to).toBe(to);
  });
  it.each([
    ['hours', 0], ['hours', 25], ['days', 31], ['months', 13], ['months', -1], ['days', 1.5],
  ] as const)('rejette %s : %i', (unit, count) => {
    expect(() => agendaPeriodRange(unit, count, now)).toThrow(RangeError);
  });
  it('24 heures restent 24 heures lors des changements d’heure', () => {
    for (const instant of ['2026-03-28T23:30:00Z', '2026-10-24T23:30:00Z']) {
      const range = agendaPeriodRange('hours', 24, new Date(instant));
      expect(range.end.getTime() - range.start.getTime()).toBe(86_400_000);
    }
  });
  it('filtre les instants, conserve les soins sans heure et exclut la borne de fin', () => {
    const range = agendaPeriodRange('hours', 1, now);
    const items = [
      item({ id: 'past', date: new Date(now.getTime() - 1).toISOString() }),
      item({ id: 'start', date: now.toISOString() }),
      item({ id: 'inside', date: new Date(now.getTime() + 1).toISOString() }),
      item({ id: 'end', date: range.end.toISOString() }),
      item({ id: 'all-day', allDay: true, day: range.from }),
      item({ id: 'tomorrow', allDay: true, day: range.to }),
      item({ id: 'later', allDay: true, day: '2026-10-05' }),
    ];
    expect(filterPeriodItems(items, range).map((i) => i.id)).toEqual(['start', 'inside', 'all-day', 'tomorrow']);
  });
});
