import type { AgendaItem } from '../agenda';
import {
  ageOf,
  animalAlerts,
  careStatusOf,
  commonName,
  formatWeight,
  lastWeighing,
  latinName,
  sheetTimeline,
  speciesTip,
  summarizeAgenda,
  timelineItems,
  weightTrend,
} from '../today';

/** Vendredi 2 octobre 2026, 10 h (heure locale). */
const NOW = new Date(2026, 9, 2, 10, 0);
const iso = (day: number, hour = 12, month = 9) => new Date(2026, month, day, hour, 0).toISOString();
const key = (day: number) => `2026-10-${String(day).padStart(2, '0')}`;

const item = (over: Partial<AgendaItem>): AgendaItem => ({
  id: 'i',
  date: iso(2, 8),
  day: key(2),
  allDay: false,
  type: 'routine',
  animalId: 'a1',
  animalName: 'Kaa',
  title: 'Nourrissage',
  detail: null,
  status: 'pending',
  sourceId: 's',
  ...over,
});

describe('agenda → frise', () => {
  it('statut : fait, annulé, en retard (veille ou heure dépassée), à faire, prévu', () => {
    expect(careStatusOf(item({ status: 'done' }), NOW)).toBe('done');
    expect(careStatusOf(item({ status: 'cancelled' }), NOW)).toBe('skipped');
    expect(careStatusOf(item({ date: iso(1, 19), day: key(1) }), NOW)).toBe('overdue');
    expect(careStatusOf(item({ date: iso(2, 8) }), NOW)).toBe('overdue'); // 8 h, il est 10 h
    expect(careStatusOf(item({ date: iso(2, 9, 9) }), NOW)).toBe('due'); // dans la marge d'une heure
    expect(careStatusOf(item({ date: iso(2, 20) }), NOW)).toBe('due');
    expect(careStatusOf(item({ allDay: true, day: key(2), date: iso(2, 0) }), NOW)).toBe('due');
    expect(careStatusOf(item({ date: iso(5, 9), day: key(5) }), NOW)).toBe('planned');
  });

  it('résumé du jour : à faire, en retard, faits aujourd’hui, rendez-vous à venir', () => {
    const items = [
      item({ id: '1', date: iso(1, 19), day: key(1) }),
      item({ id: '2', date: iso(2, 20) }),
      item({ id: '3', date: iso(2, 7), status: 'done' }),
      item({ id: '4', date: iso(6, 14), day: key(6), type: 'vet_appointment' }),
    ];
    expect(summarizeAgenda(items, NOW)).toEqual({ due: 1, overdue: 1, done: 1, appointments: 1 });
  });

  it('frise : au plus 3 retards (les plus récents) puis la suite, dans la limite', () => {
    const overdue = [27, 28, 29, 30].map((d) => item({ id: `o${d}`, date: iso(d, 9, 8), day: `2026-09-${d}` }));
    const next = [3, 4, 5].map((d) => item({ id: `n${d}`, date: iso(d, 9), day: key(d) }));
    const ids = timelineItems([...next, ...overdue], NOW, 5).map((i) => i.id);
    expect(ids).toEqual(['o28', 'o29', 'o30', 'n3', 'n4']);
  });
});

describe('alertes graduées', () => {
  const animal = { id: 'a1', name: 'Kaa' };

  it('vaccin dépassé → urgent ; dans 30 jours → à prévoir ; le rappel le plus récent fait foi', () => {
    const alerts = animalAlerts(
      {
        animal,
        vaccinations: [
          { id: 'v1', name: 'Rage', date: iso(1, 12, 0), nextDueDate: iso(25, 12, 8) },
          { id: 'v2', name: 'rage', date: iso(1, 12, 3), nextDueDate: iso(20, 12) },
          { id: 'v3', name: 'Vermifuge', date: iso(1, 12, 5), nextDueDate: iso(28, 12, 8) },
        ],
      },
      NOW,
    );
    expect(alerts.map((a) => [a.kind, a.level, a.subject, a.days])).toEqual([
      ['vaccineOverdue', 'urgent', 'Vermifuge', -4],
      ['vaccineSoon', 'warning', 'rage', 18],
    ]);
  });

  it('traitement en cours → information (pas ceux terminés, arrêtés ou à venir)', () => {
    const alerts = animalAlerts(
      {
        animal,
        medications: [
          { id: 'm1', name: 'Metacam', dose: '0,2', frequency: 'daily', startDate: iso(28, 8, 8), endDate: iso(9, 8), active: true },
          { id: 'm2', name: 'Ancien', dose: '1', frequency: 'daily', startDate: iso(1, 8, 0), endDate: iso(10, 8, 0), active: true },
          { id: 'm3', name: 'Arrêté', dose: '1', frequency: 'daily', startDate: iso(1, 8, 8), endDate: null, active: false },
          { id: 'm4', name: 'Futur', dose: '1', frequency: 'daily', startDate: iso(10, 8), endDate: null, active: true },
        ],
      },
      NOW,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'treatment', level: 'info', subject: 'Metacam', days: 7 });
  });

  it('pesée : > 90 jours → à prévoir, > 30 jours → information, aucune → information', () => {
    const at = (daysAgo: number) => [{ id: 'w', weightKg: 2.3, measuredAt: new Date(2026, 9, 2 - daysAgo, 9).toISOString() }];
    expect(animalAlerts({ animal, measurements: at(120) }, NOW)[0]).toMatchObject({ kind: 'weighingOld', level: 'warning', days: -120 });
    expect(animalAlerts({ animal, measurements: at(41) }, NOW)[0]).toMatchObject({ kind: 'weighingStale', level: 'info', days: -41 });
    expect(animalAlerts({ animal, measurements: at(10) }, NOW)).toEqual([]);
    expect(animalAlerts({ animal, measurements: [] }, NOW)[0]).toMatchObject({ kind: 'weighingNone' });
    // Section non chargée (null) : aucune alerte inventée.
    expect(animalAlerts({ animal, measurements: null, vaccinations: null, medications: null }, NOW)).toEqual([]);
  });
});

describe('mesures, âge, espèce', () => {
  const measurements = [
    { id: '1', weightKg: 2.21, measuredAt: iso(5, 9, 5) },
    { id: '2', weightKg: null, heightCm: 170, measuredAt: iso(1, 9) },
    { id: '3', weightKg: 2.34, measuredAt: iso(23, 9, 7) },
    { id: '4', weightKg: 2.28, measuredAt: iso(15, 9, 6) },
  ];

  it('dernière pesée et variation entre les deux dernières', () => {
    expect(lastWeighing(measurements)?.id).toBe('3');
    expect(weightTrend(measurements)).toBeCloseTo(0.06);
    expect(weightTrend(measurements.slice(0, 2))).toBeNull();
  });

  it('poids : grammes sous 10 kg, kilogrammes au-delà, dans la locale', () => {
    expect(formatWeight(2.34, 'fr').replace(/\s/g, ' ')).toBe('2 340 g');
    expect(formatWeight(12.46, 'fr').replace(/\s/g, ' ')).toBe('12,5 kg');
    expect(formatWeight(0.06, 'en', true)).toBe('+60 g');
  });

  it('âge : années révolues, mois sous un an, rien sans date valide', () => {
    expect(ageOf('2023-04-12T00:00:00.000Z', NOW)).toEqual({ value: 3, unit: 'year' });
    expect(ageOf('2026-03-20T00:00:00.000Z', NOW)).toEqual({ value: 6, unit: 'month' });
    expect(ageOf(undefined, NOW)).toBeNull();
    expect(ageOf('2030-01-01', NOW)).toBeNull();
  });

  it('binôme latin sans autorité, nom commun dans la langue de l’utilisateur', () => {
    expect(latinName({ scientificName: 'Boa constrictor Linnaeus, 1758' })).toBe('Boa constrictor');
    expect(latinName({ scientificName: 'Python regius (Shaw, 1802)', canonicalName: 'Python regius' })).toBe('Python regius');
    expect(latinName({ scientificName: 'Boa constrictor imperator Daudin, 1803' })).toBe('Boa constrictor imperator');
    const boa = { profile: { commonNameFr: 'Boa constricteur' }, vernacularName: 'Boa' };
    expect(commonName(boa, 'fr')).toBe('Boa constricteur');
    expect(commonName(boa, 'en')).toBe('Boa');
  });

  it('conseil : la prévention sourcée, sinon les repères d’ambiance, sinon rien', () => {
    const health = { editorial: { diseases: [{ name: 'Stomatite', prevention: ' Hygiène du terrarium. ' }] } };
    expect(speciesTip(null, health)).toEqual({ kind: 'prevention', topic: 'Stomatite', text: 'Hygiène du terrarium.' });
    expect(speciesTip({ habitat: { temperature: '28-32 °C', humidity: '60-70 %' } }, { editorial: { diseases: [] } })).toEqual({
      kind: 'habitat',
      temperature: '28-32 °C',
      humidity: '60-70 %',
    });
    expect(speciesTip({}, null)).toBeNull();
  });
});

describe('frise de la fiche', () => {
  it('3 derniers repères puis 5 prochaines échéances, dans l’ordre chronologique', () => {
    const events = sheetTimeline(
      {
        vetAppointments: [
          { id: 'a1', vetName: 'Dr Martin', date: iso(8, 14), status: 'scheduled', reminderDays: [] },
          { id: 'a2', vetName: 'Dr Dupont', date: iso(1, 14, 0), status: 'cancelled', reminderDays: [] }, // janvier : hors des 3 derniers
          { id: 'a3', vetName: 'Oublié', date: iso(1, 14, 7), status: 'scheduled', reminderDays: [] },
        ],
        vaccinations: [{ id: 'v1', name: 'Vermifuge', date: '2026-04-06T00:00:00.000Z', nextDueDate: '2026-10-06T00:00:00.000Z' }],
        measurements: [{ id: 'w1', weightKg: 2.34, measuredAt: '2026-08-23T00:00:00.000Z' }],
        healthRecords: [{ id: 'h1', title: 'Mue difficile', date: '2026-08-04T00:00:00.000Z' }],
        medications: [{ id: 'm1', name: 'Metacam', dose: '0,2', unit: 'ml', frequency: 'daily', startDate: '2026-09-29T00:00:00.000Z', endDate: '2026-10-09T00:00:00.000Z', active: true }],
      },
      NOW,
      (kg) => `${Math.round(kg * 1000)} g`,
    );
    expect(events.map((e) => `${e.kind}:${e.status}:${e.title}`)).toEqual([
      'health:done:Mue difficile',
      'weighing:done:2340 g',
      'treatmentStart:done:Metacam',
      'vaccineDue:planned:Vermifuge',
      'visit:planned:Dr Martin',
      'treatmentEnd:planned:Metacam',
    ]);
    // Date sans heure : midi local du jour (aucun glissement à la veille selon le fuseau).
    expect(events[3].date).toBe('2026-10-06T12:00:00');
  });
});
