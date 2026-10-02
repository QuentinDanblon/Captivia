import {
  DEFAULT_TIMEZONE,
  addDays,
  dayNumber,
  localDay,
  localDayBounds,
  makeLocalTimeResolver,
  resolveTimeZone,
  timeZoneOffsetMs,
  weekdayOf,
  zonedTimeToUtc,
} from './timezone';

/** Revue de sécurité, constat 4 : heures murales locales → instants UTC (Intl, sans dépendance). */
const iso = (d: Date) => d.toISOString();

describe('zonedTimeToUtc (Europe/Paris)', () => {
  const tz = 'Europe/Paris';

  it('« 08:00 » = 06:00Z en été, 07:00Z en hiver', () => {
    expect(iso(zonedTimeToUtc('2026-07-15', 8, 0, tz))).toBe(
      '2026-07-15T06:00:00.000Z',
    );
    expect(iso(zonedTimeToUtc('2026-01-15', 8, 0, tz))).toBe(
      '2026-01-15T07:00:00.000Z',
    );
  });

  it('« 23:30 » reste sur le jour J local (21:30Z / 22:30Z le même jour)', () => {
    const summer = zonedTimeToUtc('2026-07-15', 23, 30, tz);
    expect(iso(summer)).toBe('2026-07-15T21:30:00.000Z');
    expect(localDay(summer, tz)).toBe('2026-07-15');
    const winter = zonedTimeToUtc('2026-12-31', 23, 30, tz);
    expect(iso(winter)).toBe('2026-12-31T22:30:00.000Z');
    expect(localDay(winter, tz)).toBe('2026-12-31');
  });

  it('« 00:30 » local tombe la veille en UTC mais appartient bien au jour J', () => {
    const at = zonedTimeToUtc('2026-07-15', 0, 30, tz);
    expect(iso(at)).toBe('2026-07-14T22:30:00.000Z');
    expect(localDay(at, tz)).toBe('2026-07-15');
  });

  it('semaine du passage à l’heure d’été (29 mars 2026) : 08:00 tous les jours', () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-03-26', i));
    expect(days.map((d) => iso(zonedTimeToUtc(d, 8, 0, tz)))).toEqual([
      '2026-03-26T07:00:00.000Z',
      '2026-03-27T07:00:00.000Z',
      '2026-03-28T07:00:00.000Z',
      '2026-03-29T06:00:00.000Z',
      '2026-03-30T06:00:00.000Z',
      '2026-03-31T06:00:00.000Z',
      '2026-04-01T06:00:00.000Z',
    ]);
  });

  it('heure inexistante (02:30 le 29 mars) → 03:30 heure d’été (décalage d’avant, RFC 5545)', () => {
    const at = zonedTimeToUtc('2026-03-29', 2, 30, tz);
    expect(iso(at)).toBe('2026-03-29T01:30:00.000Z');
    expect(iso(zonedTimeToUtc('2026-03-29', 3, 30, tz))).toBe(
      '2026-03-29T01:30:00.000Z',
    );
  });

  it('heure ambiguë (02:30 le 25 octobre) → première occurrence (heure d’été)', () => {
    expect(iso(zonedTimeToUtc('2026-10-25', 2, 30, tz))).toBe(
      '2026-10-25T00:30:00.000Z',
    );
    expect(iso(zonedTimeToUtc('2026-10-25', 3, 30, tz))).toBe(
      '2026-10-25T02:30:00.000Z',
    );
  });

  it('bornes du jour local : 23 h le 29 mars, 25 h le 25 octobre', () => {
    const spring = localDayBounds('2026-03-29', tz);
    expect(iso(spring.start)).toBe('2026-03-28T23:00:00.000Z');
    expect(iso(spring.end)).toBe('2026-03-29T21:59:59.999Z');
    const autumn = localDayBounds('2026-10-25', tz);
    expect(iso(autumn.start)).toBe('2026-10-24T22:00:00.000Z');
    expect(iso(autumn.end)).toBe('2026-10-25T22:59:59.999Z');
  });
});

describe('autres fuseaux', () => {
  it('New York (UTC-5 / UTC-4) et Tokyo (sans heure d’été)', () => {
    expect(iso(zonedTimeToUtc('2026-01-15', 8, 0, 'America/New_York'))).toBe(
      '2026-01-15T13:00:00.000Z',
    );
    expect(iso(zonedTimeToUtc('2026-07-15', 8, 0, 'America/New_York'))).toBe(
      '2026-07-15T12:00:00.000Z',
    );
    expect(iso(zonedTimeToUtc('2026-07-15', 8, 0, 'Asia/Tokyo'))).toBe(
      '2026-07-14T23:00:00.000Z',
    );
    expect(timeZoneOffsetMs(Date.UTC(2026, 6, 15), 'Asia/Tokyo')).toBe(
      9 * 3_600_000,
    );
  });

  it('fuseau absent ou invalide : Europe/Paris', () => {
    expect(DEFAULT_TIMEZONE).toBe('Europe/Paris');
    expect(resolveTimeZone(undefined)).toBe('Europe/Paris');
    expect(resolveTimeZone('Not/AZone')).toBe('Europe/Paris');
    expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(iso(zonedTimeToUtc('2026-07-15', 8, 0, 'Not/AZone'))).toBe(
      '2026-07-15T06:00:00.000Z',
    );
  });
});

describe('makeLocalTimeResolver (cache par jour)', () => {
  it('donne les mêmes instants que zonedTimeToUtc, changements d’heure compris', () => {
    const resolve = makeLocalTimeResolver('Europe/Paris');
    for (let i = 0; i < 400; i += 1) {
      const day = addDays('2026-01-01', i);
      for (const [h, m] of [
        [0, 0],
        [2, 30],
        [8, 0],
        [23, 30],
      ]) {
        expect(iso(resolve(day, h, m))).toBe(
          iso(zonedTimeToUtc(day, h, m, 'Europe/Paris')),
        );
      }
    }
  });
});

describe('jours calendaires', () => {
  it('addDays, dayNumber et weekdayOf ne dépendent pas d’un instant', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-28')).toBe(2);
    expect(weekdayOf('2026-03-29')).toBe(0); // dimanche
    expect(localDay(new Date('2026-03-10T23:30:00Z'), 'Europe/Paris')).toBe(
      '2026-03-11',
    );
  });
});
