import {
  addDays,
  dayNumber,
  dayOfMonthOf,
  localDay,
  weekdayOf,
} from './timezone';

/**
 * Occurrences des soins : SOURCE DE VÉRITÉ UNIQUE (fonctions pures, sans base de données).
 *
 * Utilisée à l'identique par :
 *  - le générateur de rappels serveur (`GradeService`, `NotificationEvent`) ;
 *  - l'Agenda des soins (`AgendaService`, vue, flux iCalendar) — d'où l'app native tire ses
 *    notifications locales (W6-06) ;
 *  - la couverture locale du scheduler (`notifications/local-coverage.ts`, W6-07), qui exige la
 *    correspondance EXACTE des instants entre rappel serveur et Agenda.
 * Toute règle de récurrence (fréquences des médicaments et des routines, dates de début / fin,
 * fuseau `User.timezone`, changements d'heure) se modifie ICI, jamais dans un appelant : rappels
 * serveur, Agenda et rappels du téléphone restent ainsi toujours cohérents.
 */

/** Heure LOCALE des rappels « du jour » (médicament, RDV vétérinaire, vaccin). */
export const REMINDER_ANCHOR_HOUR = 8;

/** Mapping des noms de jours (format seed) vers getDay() JS : 0=dimanche … 6=samedi */
const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface NormalizedSchedule {
  time?: string;
  recurrence?: string;
  date?: string;
  weekDay?: number;
  dayOfMonth?: number;
  intervalHours?: number;
  days?: number[];
}

/** Heure HH:mm (1 ou 2 chiffres pour l'heure : l'ancien format scheduler produit "8:00"). */
export const SCHEDULE_TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const SCHEDULE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Entier borné, sinon undefined (les valeurs hors bornes sont ignorées, pas écrêtées). */
function boundedInt(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
    ? v
    : undefined;
}

/** Retourne [heure, minute] d'une heure valide, ou le repli donné. */
function parseTime(
  time: string | undefined,
  fallback: [number, number] = [8, 0],
): [number, number] {
  const m = time ? SCHEDULE_TIME_REGEX.exec(time) : null;
  return m ? [Number(m[1]), Number(m[2])] : fallback;
}

/**
 * Normalise les formats de schedule rencontrés dans le codebase, avec des bornes défensives
 * (le JSON vient de l'utilisateur : toute valeur hors bornes est ignorée) :
 * - frontend (routines + prefs) : { time: '08:00', recurrence: 'daily', weekDay?, dayOfMonth?, date?, intervalHours? }
 * - seed :                        { days: ['tuesday','friday'], time: '19:00' }
 * - ancien format scheduler :     { hour: 8, day: 2, date: 15, hours: [8, 20] }
 */
export function normalizeSchedule(raw: unknown): NormalizedSchedule {
  const s = (
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  ) as Record<string, unknown>;

  let time: string | undefined =
    typeof s.time === 'string' && SCHEDULE_TIME_REGEX.test(s.time)
      ? s.time
      : undefined;
  const hour = boundedInt(s.hour, 0, 23);
  if (!time && hour !== undefined) time = `${hour}:00`;
  const firstHour = Array.isArray(s.hours)
    ? boundedInt(s.hours[0], 0, 23)
    : undefined;
  if (!time && firstHour !== undefined) time = `${firstHour}:00`;

  const weekDay = boundedInt(s.weekDay, 0, 6) ?? boundedInt(s.day, 0, 6);

  let days: number[] | undefined;
  if (Array.isArray(s.days)) {
    days = [
      ...new Set(
        s.days
          .slice(0, 14)
          .map((d) =>
            typeof d === 'number'
              ? d
              : DAY_NAME_TO_INDEX[String(d).toLowerCase()],
          )
          .filter(
            (d): d is number =>
              typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6,
          ),
      ),
    ];
  }

  const rawDate = typeof s.date === 'string' ? s.date : undefined;

  return {
    time,
    recurrence:
      typeof s.recurrence === 'string' ? s.recurrence.slice(0, 32) : undefined,
    date: rawDate && SCHEDULE_DATE_REGEX.test(rawDate) ? rawDate : undefined,
    weekDay,
    dayOfMonth: boundedInt(s.dayOfMonth, 1, 31),
    intervalHours: boundedInt(s.intervalHours, 1, 24),
    days: days && days.length > 0 ? days : undefined,
  };
}

/** Période (jours) des récurrences « tous les N jours ». */
const EVERY_N_DAYS: Record<string, number> = {
  every_2_days: 2,
  every_3_days: 3,
};

/**
 * Vérifie si la récurrence d'un schedule correspond au jour calendaire LOCAL `day` (YYYY-MM-DD).
 *
 * `every_2_days` / `every_3_days` : comptés à partir du jour d'ancrage `sch.date` (s'il est fourni)
 * ou `anchorDay` (jour local de création de la routine / des préférences), et non plus selon la
 * parité du nombre de jours depuis l'epoch : la première occurrence tombe le jour de départ, et
 * le rythme ne dépend ni du fuseau ni de l'instant de calcul. Avant l'ancrage : aucune occurrence.
 */
export function matchesSchedule(
  sch: NormalizedSchedule,
  day: string,
  anchorDay?: string,
): boolean {
  const rec = sch.recurrence || 'daily';
  if (rec === 'once') {
    if (!sch.date || sch.date !== day) return false;
  } else if (rec === 'weekly') {
    const dayOfWeek = weekdayOf(day);
    if (sch.days && sch.days.length > 0) {
      // Format seed : plusieurs jours par semaine (ex: ['tuesday','friday'])
      if (!sch.days.includes(dayOfWeek)) return false;
    } else {
      const wanted = sch.weekDay ?? 0;
      if (dayOfWeek !== wanted) return false;
    }
  } else if (rec === 'monthly') {
    const wanted = sch.dayOfMonth ?? 1;
    if (dayOfMonthOf(day) !== wanted) return false;
  } else if (EVERY_N_DAYS[rec]) {
    const period = EVERY_N_DAYS[rec];
    const anchor = sch.date ?? anchorDay;
    const diff = anchor ? dayNumber(day) - dayNumber(anchor) : dayNumber(day); // sans ancrage (ancien appelant) : repli sur l'epoch
    if (diff < 0 || diff % period !== 0) return false;
  } else if (rec === 'custom') {
    return false;
  }
  return true;
}

/** Convertit une heure murale d'un jour local en instant UTC (cf. common/timezone). */
export type LocalTimeResolver = (
  day: string,
  hour: number,
  minute: number,
) => Date;

/**
 * Occurrences d'un schedule pour le jour LOCAL `day` : 1 événement, ou une grille horaire (≤ 24)
 * si `hourly`. Les heures (« 08:00 ») sont des heures murales du fuseau de l'utilisateur,
 * converties en instants UTC par `resolve` (changements d'heure compris ; doublons retirés,
 * ex. 02:00 et 03:00 le jour du passage à l'heure d'été). Partagé avec l'Agenda des soins : la
 * vue « à venir » reste strictement identique aux rappels réellement générés.
 */
export function scheduleOccurrences(
  sch: NormalizedSchedule,
  rec: string,
  time: string | undefined,
  day: string,
  resolve: LocalTimeResolver,
): Date[] {
  if (rec === 'hourly') {
    const interval = Math.max(1, Math.min(24, sch.intervalHours ?? 2));
    const [startH] = parseTime(time);
    const out: Date[] = [];
    const seen = new Set<number>();
    for (let hour = startH; hour < 24; hour += interval) {
      const at = resolve(day, hour, 0);
      if (seen.has(at.getTime())) continue;
      seen.add(at.getTime());
      out.push(at);
    }
    return out;
  }
  const [h, m] = parseTime(time);
  return [resolve(day, h, m)];
}

const HOUR_MS = 3_600_000;

/** Champs d'un médicament qui déterminent ses prises. */
export interface MedicationOccurrenceSource {
  startDate: Date;
  endDate: Date | null;
  frequency: string;
  intervalHours: number | null;
  /** Absent : réputé actif (les appelants qui lisent la base filtrent déjà `active: true`). */
  active?: boolean;
}

/**
 * Prises d'un médicament le jour LOCAL `day` (fuseau porté par `resolve`). `startDate` /
 * `endDate` sont des dates calendaires (saisies sans heure, stockées à minuit UTC), bornes
 * incluses ; un médicament inactif n'a aucune prise.
 *  - `daily` : 08:00 heure locale, chaque jour ;
 *  - `weekly` : 08:00 heure locale, uniquement le jour de la semaine de `startDate` ;
 *  - `every_x_hours` (`intervalHours` ≥ 1) : grille d'intervalles RÉELS de N heures depuis 08:00
 *    locale du premier jour (une prise « toutes les 8 h » reste espacée de 8 h à travers un
 *    changement d'heure) ; sans intervalle valide : comme `daily` ;
 *  - fréquence inconnue : comme `daily` (comportement historique).
 */
export function medicationOccurrencesOn(
  m: MedicationOccurrenceSource,
  day: string,
  resolve: LocalTimeResolver,
): Date[] {
  if (m.active === false) return [];
  const startDay = m.startDate.toISOString().slice(0, 10);
  const endDay = m.endDate ? m.endDate.toISOString().slice(0, 10) : null;
  if (day < startDay || (endDay && day > endDay)) return [];
  if (
    m.frequency === 'every_x_hours' &&
    m.intervalHours &&
    m.intervalHours > 0
  ) {
    const step = m.intervalHours * HOUR_MS;
    const anchor = resolve(startDay, REMINDER_ANCHOR_HOUR, 0).getTime();
    const dayStart = resolve(day, 0, 0).getTime();
    const nextDayStart = resolve(addDays(day, 1), 0, 0).getTime();
    const k0 = Math.max(0, Math.ceil((dayStart - anchor) / step));
    const out: Date[] = [];
    for (let ms = anchor + k0 * step; ms < nextDayStart; ms += step) {
      out.push(new Date(ms));
    }
    return out;
  }
  if (m.frequency === 'weekly' && weekdayOf(day) !== weekdayOf(startDay)) {
    return [];
  }
  return [resolve(day, REMINDER_ANCHOR_HOUR, 0)];
}

/** Champs d'une routine qui déterminent ses occurrences. */
export interface RoutineOccurrenceSource {
  schedule: unknown;
  frequency: string;
  createdAt: Date;
  /** Absent : réputée active (les appelants qui lisent la base filtrent déjà `active: true`). */
  active?: boolean;
}

/** Récurrence d'une routine, normalisée une fois (null : sans heure ou inactive, aucun rappel). */
export interface RoutinePlan {
  sch: NormalizedSchedule;
  time: string;
  rec: string;
  createdDay: string;
}

export function routinePlan(
  r: RoutineOccurrenceSource,
  timeZone: string,
): RoutinePlan | null {
  if (r.active === false) return null;
  const sch = normalizeSchedule(r.schedule);
  if (!sch.time) return null;
  return {
    sch,
    time: sch.time,
    rec: sch.recurrence || r.frequency || 'daily',
    createdDay: localDay(r.createdAt, timeZone),
  };
}

/**
 * Occurrences d'une routine le jour LOCAL `day` : aucune avant le jour local de création, puis
 * selon la récurrence (`matchesSchedule`, ancrée sur ce jour) et l'heure murale du fuseau.
 */
export function routineOccurrencesOn(
  plan: RoutinePlan,
  day: string,
  resolve: LocalTimeResolver,
): Date[] {
  const { sch, time, rec, createdDay } = plan;
  if (day < createdDay) return [];
  if (!matchesSchedule({ ...sch, time, recurrence: rec }, day, createdDay)) {
    return [];
  }
  return scheduleOccurrences(sch, rec, time, day, resolve);
}
