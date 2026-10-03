import {
  MedicationOccurrenceSource,
  medicationOccurrencesOn,
  routineOccurrencesOn,
  routinePlan,
} from './care-occurrences';
import { addDays, makeLocalTimeResolver } from './timezone';

/**
 * Prises de médicament par fréquence — source unique des rappels serveur, de l'Agenda et des
 * rappels locaux de l'app. Fuseau Europe/Paris ; changements d'heure 2026 : dimanche 29 mars
 * (02:00 → 03:00) et dimanche 25 octobre (03:00 → 02:00).
 */
const paris = makeLocalTimeResolver('Europe/Paris');
const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

/** Heure murale à Paris (Intl, indépendant du code testé). */
const parisWall = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);

const med = (
  over: Partial<MedicationOccurrenceSource>,
): MedicationOccurrenceSource => ({
  startDate: new Date('2026-10-21T00:00:00Z'),
  endDate: null,
  frequency: 'daily',
  intervalHours: null,
  ...over,
});

/** Toutes les prises sur `n` jours locaux à partir de `from`. */
const takes = (m: MedicationOccurrenceSource, from: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(from, i)).flatMap((d) =>
    medicationOccurrencesOn(m, d, paris),
  );

describe('medicationOccurrencesOn — quotidien', () => {
  it('08:00 locale chaque jour de [début ; fin], rien avant ni après', () => {
    const m = med({
      startDate: new Date('2026-10-23T00:00:00Z'),
      endDate: new Date('2026-10-27T00:00:00Z'),
    });
    expect(iso(takes(m, '2026-10-20', 10))).toEqual([
      '2026-10-23T06:00:00.000Z', // vendredi, heure d'été
      '2026-10-24T06:00:00.000Z',
      '2026-10-25T07:00:00.000Z', // dimanche du passage à l'heure d'hiver : toujours 08:00
      '2026-10-26T07:00:00.000Z',
      '2026-10-27T07:00:00.000Z', // date de fin incluse
    ]);
  });

  it('médicament inactif : aucune prise', () => {
    expect(takes(med({ active: false }), '2026-10-21', 14)).toEqual([]);
  });

  it('fréquence inconnue (donnée historique) : comme quotidien', () => {
    expect(takes(med({ frequency: 'custom' }), '2026-10-21', 3)).toHaveLength(
      3,
    );
  });
});

describe('medicationOccurrencesOn — hebdomadaire', () => {
  it('uniquement le jour de la semaine du début, à 08:00 locale, à travers le passage à l’heure d’hiver', () => {
    // Début le mercredi 21/10/2026 ; passage à l'heure d'hiver le dimanche 25/10.
    const all = takes(med({ frequency: 'weekly' }), '2026-10-14', 28);
    expect(iso(all)).toEqual([
      '2026-10-21T06:00:00.000Z', // 08:00 CEST
      '2026-10-28T07:00:00.000Z', // 08:00 CET
      '2026-11-04T07:00:00.000Z',
    ]);
    for (const d of all) expect(parisWall(d)).toBe('mercredi 08:00');
  });

  it('à travers le passage à l’heure d’été, y compris un début le dimanche du changement', () => {
    const wed = takes(
      med({
        frequency: 'weekly',
        startDate: new Date('2026-03-25T00:00:00Z'),
      }),
      '2026-03-20',
      20,
    );
    expect(iso(wed)).toEqual([
      '2026-03-25T07:00:00.000Z', // 08:00 CET
      '2026-04-01T06:00:00.000Z', // 08:00 CEST
      '2026-04-08T06:00:00.000Z',
    ]);
    const sunday = takes(
      med({
        frequency: 'weekly',
        startDate: new Date('2026-03-29T00:00:00Z'),
      }),
      '2026-03-22',
      15,
    );
    expect(iso(sunday)).toEqual([
      '2026-03-29T06:00:00.000Z',
      '2026-04-05T06:00:00.000Z',
    ]);
    for (const d of sunday) expect(parisWall(d)).toBe('dimanche 08:00');
  });

  it('aucune prise les 6 autres jours de la semaine, ni après la fin du traitement', () => {
    const m = med({
      frequency: 'weekly',
      endDate: new Date('2026-11-03T00:00:00Z'), // mardi : le mercredi 04/11 est exclu
    });
    for (let i = 1; i <= 6; i++) {
      expect(
        medicationOccurrencesOn(m, addDays('2026-10-21', i), paris),
      ).toEqual([]);
    }
    expect(iso(takes(m, '2026-10-21', 21))).toEqual([
      '2026-10-21T06:00:00.000Z',
      '2026-10-28T07:00:00.000Z',
    ]);
  });
});

describe('medicationOccurrencesOn — toutes les N heures', () => {
  it('grille depuis 08:00 locale du premier jour (toutes les 6 h)', () => {
    const m = med({ frequency: 'every_x_hours', intervalHours: 6 });
    expect(iso(medicationOccurrencesOn(m, '2026-10-20', paris))).toEqual([]);
    expect(iso(medicationOccurrencesOn(m, '2026-10-21', paris))).toEqual([
      '2026-10-21T06:00:00.000Z', // 08:00
      '2026-10-21T12:00:00.000Z', // 14:00
      '2026-10-21T18:00:00.000Z', // 20:00
    ]);
    expect(iso(medicationOccurrencesOn(m, '2026-10-22', paris))).toEqual([
      '2026-10-22T00:00:00.000Z', // 02:00
      '2026-10-22T06:00:00.000Z',
      '2026-10-22T12:00:00.000Z',
      '2026-10-22T18:00:00.000Z',
    ]);
  });

  it('intervalles RÉELS conservés au passage à l’heure d’été (toutes les 8 h)', () => {
    const m = med({
      frequency: 'every_x_hours',
      intervalHours: 8,
      startDate: new Date('2026-03-28T00:00:00Z'),
    });
    const all = takes(m, '2026-03-28', 2);
    expect(iso(all)).toEqual([
      '2026-03-28T07:00:00.000Z', // 08:00 CET
      '2026-03-28T15:00:00.000Z', // 16:00 CET
      '2026-03-28T23:00:00.000Z', // 00:00 le 29 (CET)
      '2026-03-29T07:00:00.000Z', // 09:00 CEST
      '2026-03-29T15:00:00.000Z', // 17:00 CEST
    ]);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].getTime() - all[i - 1].getTime()).toBe(8 * 3_600_000);
    }
  });

  it('sans intervalle valide : une prise à 08:00 (comme quotidien)', () => {
    const m = med({ frequency: 'every_x_hours', intervalHours: null });
    expect(iso(medicationOccurrencesOn(m, '2026-10-22', paris))).toEqual([
      '2026-10-22T06:00:00.000Z',
    ]);
  });
});

describe('routineOccurrencesOn — inactive / avant la création', () => {
  const r = {
    schedule: { time: '07:30', recurrence: 'daily' },
    frequency: 'daily',
    createdAt: new Date('2026-10-21T10:00:00Z'),
  };

  it('aucune occurrence avant le jour local de création, puis à l’heure murale', () => {
    const plan = routinePlan(r, 'Europe/Paris');
    expect(plan).not.toBeNull();
    expect(routineOccurrencesOn(plan!, '2026-10-20', paris)).toEqual([]);
    expect(iso(routineOccurrencesOn(plan!, '2026-10-21', paris))).toEqual([
      '2026-10-21T05:30:00.000Z',
    ]);
    expect(iso(routineOccurrencesOn(plan!, '2026-10-26', paris))).toEqual([
      '2026-10-26T06:30:00.000Z',
    ]);
  });

  it('routine inactive : aucun plan', () => {
    expect(routinePlan({ ...r, active: false }, 'Europe/Paris')).toBeNull();
  });
});
