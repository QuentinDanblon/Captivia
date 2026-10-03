/**
 * Fuseaux horaires (revue de sécurité, constat 4).
 *
 * Les heures saisies par l'utilisateur (« 08:00 ») sont des heures LOCALES de son fuseau
 * (`User.timezone`, IANA). Ce module convertit « heure murale d'un jour local » ↔ instant UTC
 * avec `Intl` uniquement (aucune dépendance), changements d'heure compris :
 *  - heure inexistante (avance, ex. 02:30 le dernier dimanche de mars à Paris) : interprétée
 *    avec le décalage d'AVANT le changement, soit 03:30 heure d'été (règle RFC 5545 §3.3.5) ;
 *  - heure ambiguë (recul, ex. 02:30 le dernier dimanche d'octobre) : PREMIÈRE occurrence
 *    (heure d'été), comme RFC 5545.
 *
 * Un « jour » est une date calendaire `YYYY-MM-DD` (sans fuseau) ; les calculs de jours
 * (semaine, quantième, écarts) se font sur cette date, jamais sur un instant.
 */

/** Fuseau par défaut quand celui de l'utilisateur est absent ou invalide. */
export const DEFAULT_TIMEZONE = 'Europe/Paris';

const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Formateur (mis en cache : sa création est coûteuse) ; lève si le fuseau est invalide. */
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Fuseau IANA valide, sinon `DEFAULT_TIMEZONE`. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIMEZONE;
  try {
    partsFormatter(timeZone);
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Composantes murales (année … seconde) de l'instant `ms` dans `timeZone`. */
function wallParts(ms: number, timeZone: string): number[] {
  const parts = partsFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return [
    get('year'),
    get('month'),
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  ];
}

/** Décalage (ms) de `timeZone` par rapport à UTC à l'instant `ms` (Paris en été : +7 200 000). */
export function timeZoneOffsetMs(ms: number, timeZone: string): number {
  const [y, mo, d, h, mi, s] = wallParts(ms, timeZone);
  return Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ms / 1000) * 1000;
}

/** `YYYY-MM-DD` de l'instant `now` dans le fuseau (repli Europe/Paris si invalide). */
export function localDay(
  now: Date,
  timeZone: string | null | undefined,
): string {
  const [y, mo, d] = wallParts(now.getTime(), resolveTimeZone(timeZone));
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Minuit UTC de la date calendaire `day` (sert aux calculs de calendrier, pas à un instant local). */
export function dayToUtcMidnight(day: string): number {
  const m = DAY_RE.exec(day);
  if (!m) throw new RangeError(`Invalid day: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date calendaire décalée de `n` jours. */
export function addDays(day: string, n: number): string {
  return new Date(dayToUtcMidnight(day) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Numéro de jour calendaire (indépendant du fuseau) : écarts et périodicités sans dérive. */
export function dayNumber(day: string): number {
  return Math.round(dayToUtcMidnight(day) / DAY_MS);
}

/** Jour de semaine de la date calendaire (0 = dimanche … 6 = samedi). */
export function weekdayOf(day: string): number {
  return new Date(dayToUtcMidnight(day)).getUTCDay();
}

/** Quantième (1–31) de la date calendaire. */
export function dayOfMonthOf(day: string): number {
  return new Date(dayToUtcMidnight(day)).getUTCDate();
}

/**
 * Instant UTC de l'heure murale `hour:minute` du jour local `day` dans `timeZone`.
 * `offsets` (facultatif) : décalages en vigueur avant / après le jour, si déjà connus.
 */
export function zonedTimeToUtc(
  day: string,
  hour: number,
  minute: number,
  timeZone: string,
  offsets?: { before: number; after: number },
): Date {
  const tz = resolveTimeZone(timeZone);
  const wall = dayToUtcMidnight(day) + (hour * 60 + minute) * 60_000;
  // L'instant réel est à moins de ±14 h de `wall` : les décalages possibles sont ceux en
  // vigueur un jour avant et un jour après (au plus un changement d'heure entre les deux).
  const before = offsets?.before ?? timeZoneOffsetMs(wall - DAY_MS, tz);
  const after = offsets?.after ?? timeZoneOffsetMs(wall + DAY_MS, tz);
  if (before === after) return new Date(wall - before);

  const valid = [before, after].filter(
    (offset) => timeZoneOffsetMs(wall - offset, tz) === offset,
  );
  if (valid.length === 0) {
    // Heure inexistante (avance) : décalage d'avant le changement → décalée vers l'avant.
    return new Date(wall - before);
  }
  // Heure ambiguë (recul) : première occurrence = plus grand décalage = instant le plus tôt.
  return new Date(wall - Math.max(...valid));
}

/** Bornes [début ; fin] (instants UTC, fin incluse à la ms) du jour local `day`. */
export function localDayBounds(
  day: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(day, 0, 0, timeZone),
    end: new Date(
      zonedTimeToUtc(addDays(day, 1), 0, 0, timeZone).getTime() - 1,
    ),
  };
}

/**
 * Convertisseur « jour local + heure murale → instant UTC » pour un fuseau, avec cache par jour :
 * hors jours de changement d'heure (363 jours sur 365), une conversion est une soustraction.
 * Utilisé par l'agenda (jusqu'à 92 jours × 1 000 routines × 24 occurrences).
 */
export function makeLocalTimeResolver(
  timeZone: string | null | undefined,
): (day: string, hour: number, minute: number) => Date {
  const tz = resolveTimeZone(timeZone);
  const cache = new Map<string, { before: number; after: number }>();
  return (day, hour, minute) => {
    let offsets = cache.get(day);
    if (!offsets) {
      const midnight = dayToUtcMidnight(day);
      offsets = {
        before: timeZoneOffsetMs(midnight - DAY_MS, tz),
        after: timeZoneOffsetMs(midnight + 2 * DAY_MS, tz),
      };
      cache.set(day, offsets);
    }
    return zonedTimeToUtc(day, hour, minute, tz, offsets);
  };
}
