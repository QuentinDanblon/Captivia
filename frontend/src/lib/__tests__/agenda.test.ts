import {
  buildFeedUrl,
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
