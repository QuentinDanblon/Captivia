import { addDays, localDay, weekdayOf } from '../common/timezone';
import {
  LocalTimeResolver,
  NormalizedSchedule,
  REMINDER_ANCHOR_HOUR,
  matchesSchedule,
  normalizeSchedule,
  scheduleOccurrences,
} from '../grade/grade.service';

/**
 * Occurrences des soins telles que l'Agenda les expose (fonctions pures, partagées).
 *
 * L'app native programme ses notifications locales à partir de l'Agenda (W6-06) : ces fonctions
 * disent donc aussi QUELS instants sont programmés sur le téléphone. Le scheduler s'en sert pour
 * décider qu'un rappel serveur est réellement couvert localement (W6-07, revue de sécurité,
 * constat 1) : même source, même instant, sinon le push part.
 */

const HOUR_MS = 3_600_000;

/** Champs d'un médicament qui déterminent ses prises. */
export interface MedicationOccurrenceSource {
  startDate: Date;
  endDate: Date | null;
  frequency: string;
  intervalHours: number | null;
}

/**
 * Prises d'un médicament le jour LOCAL `day` : 08:00 heure locale (hebdomadaire : le même jour de
 * la semaine que le début), ou toutes les N heures depuis 08:00 du premier jour. `startDate` /
 * `endDate` sont des dates calendaires (stockées à minuit UTC).
 */
export function medicationOccurrencesOn(
  m: MedicationOccurrenceSource,
  day: string,
  resolve: LocalTimeResolver,
): Date[] {
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
}

/** Récurrence d'une routine, normalisée une fois (null : sans heure, aucun rappel). */
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
  const sch = normalizeSchedule(r.schedule);
  if (!sch.time) return null;
  return {
    sch,
    time: sch.time,
    rec: sch.recurrence || r.frequency || 'daily',
    createdDay: localDay(r.createdAt, timeZone),
  };
}

/** Occurrences d'une routine le jour LOCAL `day` (mêmes règles que le générateur de rappels). */
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
