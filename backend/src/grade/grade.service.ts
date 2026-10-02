import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoutinesService } from '../routines/routines.service';

/** Seules les routines (rappels liés à une routine) donnent des points. 2 pts par routine effectuée. */
const POINTS_PER_ROUTINE_DONE = 2;

/** Plafond défensif d'événements générés par jour et par utilisateur (anti-DoS, W0-07). */
export const MAX_EVENTS_PER_DAY = 200;

const GRADE_THRESHOLDS: { grade: string; minPoints: number }[] = [
  { grade: 'bronze', minPoints: 0 },
  { grade: 'silver', minPoints: 500 },
  { grade: 'gold', minPoints: 1500 },
  { grade: 'platinum', minPoints: 3000 },
  { grade: 'diamond', minPoints: 5000 },
];

function pointsToGrade(points: number): string {
  let current = GRADE_THRESHOLDS[0];
  for (const t of GRADE_THRESHOLDS) {
    if (points >= t.minPoints) current = t;
  }
  return current.grade;
}

function getNextGrade(currentGrade: string): string | null {
  const i = GRADE_THRESHOLDS.findIndex((t) => t.grade === currentGrade);
  if (i < 0 || i >= GRADE_THRESHOLDS.length - 1) return null;
  return GRADE_THRESHOLDS[i + 1].grade;
}

function getProgress(points: number): {
  currentGrade: string;
  nextGrade: string | null;
  pointsInCurrent: number;
  pointsNeededForNext: number;
  progressPercent: number;
} {
  const currentGrade = pointsToGrade(points);
  const currentIndex = GRADE_THRESHOLDS.findIndex(
    (t) => t.grade === currentGrade,
  );
  const currentMin = GRADE_THRESHOLDS[currentIndex].minPoints;
  const nextGrade = getNextGrade(currentGrade);
  const nextMin = nextGrade
    ? GRADE_THRESHOLDS[GRADE_THRESHOLDS.findIndex((t) => t.grade === nextGrade)]
        .minPoints
    : currentMin;
  const pointsInCurrent = points - currentMin;
  const pointsNeededForNext = nextMin - currentMin;
  const progressPercent =
    pointsNeededForNext > 0
      ? Math.min(100, (pointsInCurrent / pointsNeededForNext) * 100)
      : 100;
  return {
    currentGrade,
    nextGrade,
    pointsInCurrent,
    pointsNeededForNext,
    progressPercent,
  };
}

const ROUTINE_TYPE_LABELS: Record<string, string> = {
  nourrissage: 'Nourrissage',
  entretien: 'Nettoyage',
  uvb: 'UVB / éclairage',
  controle: 'Santé',
};

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

interface NormalizedSchedule {
  time?: string;
  recurrence?: string;
  date?: string;
  weekDay?: number;
  dayOfMonth?: number;
  intervalHours?: number;
  days?: number[];
}

/** Heure HH:mm (1 ou 2 chiffres pour l'heure : l'ancien format scheduler produit "8:00"). */
const SCHEDULE_TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;
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

/** Vérifie si la récurrence d'un schedule correspond au jour demandé. */
function matchesSchedule(
  sch: NormalizedSchedule,
  todayStr: string,
  dayOfWeek: number,
  dayOfMonth: number,
  daysSinceEpoch: number,
): boolean {
  const rec = sch.recurrence || 'daily';
  if (rec === 'once') {
    if (!sch.date || sch.date !== todayStr) return false;
  } else if (rec === 'weekly') {
    if (sch.days && sch.days.length > 0) {
      // Format seed : plusieurs jours par semaine (ex: ['tuesday','friday'])
      if (!sch.days.includes(dayOfWeek)) return false;
    } else {
      const wanted = sch.weekDay ?? 0;
      if (dayOfWeek !== wanted) return false;
    }
  } else if (rec === 'monthly') {
    const wanted = sch.dayOfMonth ?? 1;
    if (dayOfMonth !== wanted) return false;
  } else if (rec === 'every_2_days') {
    if (daysSinceEpoch % 2 !== 0) return false;
  } else if (rec === 'every_3_days') {
    if (daysSinceEpoch % 3 !== 0) return false;
  } else if (rec === 'custom') {
    return false;
  }
  return true;
}

/** Événement à créer (avant insertion groupée). `sourceKey` = clé d'idempotence (unique par user + date). */
type NewEvent = Prisma.NotificationEventCreateManyInput & {
  sourceKey: string;
  scheduledAt: Date;
};

@Injectable()
export class GradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routinesService: RoutinesService,
  ) {}

  async getGrade(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true, grade: true },
    });
    if (!user) return null;
    const progress = getProgress(user.points);
    // Mettre à jour le grade stocké si besoin
    if (user.grade !== progress.currentGrade) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { grade: progress.currentGrade },
      });
    }
    return {
      points: user.points,
      grade: progress.currentGrade,
      nextGrade: progress.nextGrade,
      pointsInCurrent: progress.pointsInCurrent,
      pointsNeededForNext: progress.pointsNeededForNext,
      progressPercent: Math.round(progress.progressPercent * 10) / 10,
    };
  }

  /** Occurrences d'un schedule pour la journée : 1 événement, ou une grille horaire (≤ 24) si `hourly`. */
  private occurrences(
    sch: NormalizedSchedule,
    rec: string,
    time: string | undefined,
    date: Date,
  ): Date[] {
    if (rec === 'hourly') {
      const interval = Math.max(1, Math.min(24, sch.intervalHours ?? 2));
      const [startH] = parseTime(time);
      const out: Date[] = [];
      for (let hour = startH; hour < 24; hour += interval) {
        const at = new Date(date);
        at.setUTCHours(hour, 0, 0, 0);
        out.push(at);
      }
      return out;
    }
    const [h, m] = parseTime(time);
    const at = new Date(date);
    at.setUTCHours(h, m, 0, 0);
    return [at];
  }

  async getOrCreateTodayEvents(
    userId: string,
    dateStr?: string,
    refresh = false,
  ): Promise<
    {
      id: string;
      type: string;
      label: string | null;
      scheduledAt: string;
      status: string;
      pointsAwarded: number;
    }[]
  > {
    const date = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    const dayWhere = { userId, scheduledAt: { gte: start, lte: end } };

    let events = await this.prisma.notificationEvent.findMany({
      where: dayWhere,
      orderBy: { scheduledAt: 'asc' },
      take: MAX_EVENTS_PER_DAY * 2,
    });

    if (refresh && events.length > 0) {
      // Ne supprime QUE les rappels en attente : les événements traités (done / skipped)
      // sont conservés (sinon « refresh » permettrait de recréditer des points à l'infini).
      await this.prisma.notificationEvent.deleteMany({
        where: { ...dayWhere, status: 'pending' },
      });
    }

    if (events.length === 0 || refresh) {
      const kept = refresh
        ? await this.prisma.notificationEvent.count({ where: dayWhere })
        : events.length;
      const budget = Math.max(0, MAX_EVENTS_PER_DAY - kept);

      if (budget > 0) {
        const candidates = await this.buildCandidateEvents(userId, date);
        if (candidates.length > 0) {
          await this.prisma.notificationEvent.createMany({
            data: candidates.slice(0, budget),
            // L'index unique (userId, sourceKey, scheduledAt) rend la génération idempotente,
            // y compris sous requêtes concurrentes ; les événements déjà traités ne sont pas recréés.
            skipDuplicates: true,
          });
        }
      }

      events = await this.prisma.notificationEvent.findMany({
        where: dayWhere,
        orderBy: { scheduledAt: 'asc' },
        take: MAX_EVENTS_PER_DAY * 2,
      });
    }

    return events.map((e) => ({
      id: e.id,
      type: e.type,
      label: e.label,
      scheduledAt: e.scheduledAt.toISOString(),
      status: e.status,
      pointsAwarded: e.pointsAwarded,
      routineId: e.routineId ?? undefined,
      medicationId: e.medicationId ?? undefined,
      appointmentId: e.appointmentId ?? undefined,
      vaccinationId: e.vaccinationId ?? undefined,
    }));
  }

  /**
   * Construit (sans écrire) la liste des événements du jour : préférences, routines,
   * médicaments, RDV vétérinaires, rappels de vaccin. Dédoublonnée par (sourceKey, scheduledAt)
   * et plafonnée à MAX_EVENTS_PER_DAY.
   */
  private async buildCandidateEvents(
    userId: string,
    date: Date,
  ): Promise<NewEvent[]> {
    const todayStr = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getUTCDay();
    const dayOfMonth = date.getUTCDate();
    const daysSinceEpoch = Math.floor(date.getTime() / 86400000);

    const out: NewEvent[] = [];
    const seen = new Set<string>();
    const push = (ev: NewEvent): void => {
      if (out.length >= MAX_EVENTS_PER_DAY) return;
      const key = `${ev.sourceKey}|${ev.scheduledAt.getTime()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(ev);
    };
    const at8 = (): Date => {
      const d = new Date(date);
      d.setUTCHours(8, 0, 0, 0);
      return d;
    };

    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (
      prefs?.types &&
      typeof prefs.types === 'object' &&
      !Array.isArray(prefs.types)
    ) {
      const types = prefs.types as Record<string, boolean>;
      const rawSchedules =
        prefs.typeSchedules && typeof prefs.typeSchedules === 'object'
          ? (prefs.typeSchedules as Record<string, unknown>)
          : {};
      const rawStart =
        prefs.schedule &&
        typeof prefs.schedule === 'object' &&
        typeof (prefs.schedule as { start?: unknown }).start === 'string'
          ? (prefs.schedule as { start: string }).start
          : undefined;
      const globalStart =
        rawStart && SCHEDULE_TIME_REGEX.test(rawStart) ? rawStart : '08:00';

      for (const [type, enabled] of Object.entries(types).slice(0, 100)) {
        if (!enabled) continue;
        const sch = normalizeSchedule(rawSchedules[type]);
        const time = sch.time ?? globalStart;
        const rec = sch.recurrence || 'daily';
        if (
          !matchesSchedule(
            { ...sch, time, recurrence: rec },
            todayStr,
            dayOfWeek,
            dayOfMonth,
            daysSinceEpoch,
          )
        )
          continue;

        for (const scheduledAt of this.occurrences(sch, rec, time, date)) {
          push({
            userId,
            type,
            label: type,
            scheduledAt,
            status: 'pending',
            sourceKey: `pref:${type}`,
          });
        }
      }
    }

    // Événements depuis les routines (associées aux animaux) — TOUJOURS générés,
    // même sans préférences de notification configurées.
    const activeRoutines = await this.routinesService.getActiveRoutines(userId);
    for (const routine of activeRoutines) {
      const sch = normalizeSchedule(routine.schedule);
      const time = sch.time;
      if (!time) continue;
      const rec = sch.recurrence || routine.frequency || 'daily';
      if (
        !matchesSchedule(
          { ...sch, time, recurrence: rec },
          todayStr,
          dayOfWeek,
          dayOfMonth,
          daysSinceEpoch,
        )
      )
        continue;

      const typeLabel =
        routine.name || ROUTINE_TYPE_LABELS[routine.type] || routine.type;
      for (const scheduledAt of this.occurrences(sch, rec, time, date)) {
        push({
          userId,
          type: routine.type,
          label: typeLabel,
          scheduledAt,
          status: 'pending',
          routineId: routine.id,
          animalId: routine.animalId,
          sourceKey: `routine:${routine.id}`,
        });
      }
    }

    // Module A — Événements depuis les médicaments actifs (Premium)
    const activeMedications = await this.prisma.medication.findMany({
      where: { active: true, animal: { userId } },
      take: MAX_EVENTS_PER_DAY,
    });
    for (const med of activeMedications) {
      const startDay = med.startDate.toISOString().slice(0, 10);
      const endDay = med.endDate
        ? med.endDate.toISOString().slice(0, 10)
        : null;
      if (startDay > todayStr) continue;
      if (endDay && endDay < todayStr) continue;

      push({
        userId,
        type: 'medication',
        label: `💊 ${med.name} (${med.dose})`,
        scheduledAt: at8(),
        status: 'pending',
        pointsAwarded: 0,
        medicationId: med.id,
        animalId: med.animalId,
        sourceKey: `medication:${med.id}`,
      });
    }

    // Module A — Événements depuis les RDV vétérinaires (Premium)
    const scheduledAppointments = await this.prisma.vetAppointment.findMany({
      where: { status: 'scheduled', animal: { userId } },
      take: MAX_EVENTS_PER_DAY,
    });
    for (const appt of scheduledAppointments) {
      const apptDay = appt.date.toISOString().slice(0, 10);

      // Événement du jour du RDV
      if (apptDay === todayStr) {
        push({
          userId,
          type: 'vet_appointment',
          label: `🏥 RDV ${appt.vetName}`,
          scheduledAt: at8(),
          status: 'pending',
          pointsAwarded: 0,
          appointmentId: appt.id,
          animalId: appt.animalId,
          sourceKey: `appointment:${appt.id}`,
        });
      }

      // Rappels J-N (reminderDays jours avant le RDV). Un rappel J-0 est déjà couvert par
      // l'événement du jour (même clé + même heure → dédoublonné par `push`).
      for (const n of (appt.reminderDays ?? []).slice(0, 10)) {
        const reminderDate = new Date(appt.date);
        reminderDate.setUTCDate(reminderDate.getUTCDate() - n);
        if (reminderDate.toISOString().slice(0, 10) !== todayStr) continue;
        push({
          userId,
          type: 'vet_appointment',
          label: `🔔 ${appt.vetName} (J-${n})`,
          scheduledAt: at8(),
          status: 'pending',
          pointsAwarded: 0,
          appointmentId: appt.id,
          animalId: appt.animalId,
          sourceKey: `appointment:${appt.id}`,
        });
      }
    }

    // Module C — Événements de rappel vaccin (Premium) : un rappel est créé le
    // jour où nextDueDate == aujourd'hui
    const vaccinations = await this.prisma.vaccination.findMany({
      where: { animal: { userId }, nextDueDate: { not: null } },
      take: MAX_EVENTS_PER_DAY * 2,
    });
    for (const vac of vaccinations) {
      if (!vac.nextDueDate) continue;
      if (vac.nextDueDate.toISOString().slice(0, 10) !== todayStr) continue;

      push({
        userId,
        type: 'vaccination',
        label: `💉 Rappel vaccin ${vac.name}`,
        scheduledAt: at8(),
        status: 'pending',
        pointsAwarded: 0,
        vaccinationId: vac.id,
        animalId: vac.animalId,
        sourceKey: `vaccination:${vac.id}`,
      });
    }

    return out.sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );
  }

  async setEventStatus(
    userId: string,
    eventId: string,
    status: 'done' | 'skipped',
  ): Promise<{ event: unknown; grade: unknown } | null> {
    // Transition atomique pending -> done|skipped + crédit de points dans UNE transaction :
    // `updateMany where status = 'pending'` ne réussit (count === 1) que pour UNE requête, donc
    // deux requêtes parallèles ne peuvent pas créditer deux fois les points.
    const applied = await this.prisma.$transaction(async (tx) => {
      const ev = await tx.notificationEvent.findFirst({
        where: { id: eventId, userId },
        select: { routineId: true, scheduledAt: true },
      });
      if (!ev) return false;

      // Seules les routines (ev.routineId) donnent des points. Les notifications seules n'en donnent pas.
      // Pas de points pour un événement futur (au-delà de 24 h : tolérance de fuseau horaire),
      // sinon on pourrait « faire » à l'avance les routines des 12 prochains mois.
      const notInFuture =
        ev.scheduledAt.getTime() <= Date.now() + 24 * 3600 * 1000;
      const pointsToAdd =
        status === 'done' && ev.routineId && notInFuture
          ? POINTS_PER_ROUTINE_DONE
          : 0;

      const res = await tx.notificationEvent.updateMany({
        where: { id: eventId, userId, status: 'pending' },
        data: { status, pointsAwarded: pointsToAdd },
      });
      if (res.count !== 1) return false;

      if (pointsToAdd > 0) {
        const user = await tx.user.update({
          where: { id: userId },
          data: { points: { increment: pointsToAdd } },
          select: { points: true },
        });
        await tx.user.update({
          where: { id: userId },
          data: { grade: pointsToGrade(user.points) },
        });
      }
      return true;
    });

    if (!applied) return null;

    const updated = await this.prisma.notificationEvent.findUnique({
      where: { id: eventId },
    });
    const grade = await this.getGrade(userId);
    return {
      event: updated
        ? {
            id: updated.id,
            type: updated.type,
            label: updated.label,
            scheduledAt: updated.scheduledAt.toISOString(),
            status: updated.status,
            pointsAwarded: updated.pointsAwarded,
            routineId: updated.routineId ?? undefined,
            medicationId: updated.medicationId ?? undefined,
            appointmentId: updated.appointmentId ?? undefined,
            vaccinationId: updated.vaccinationId ?? undefined,
          }
        : null,
      grade,
    };
  }

  /**
   * Supprime uniquement le rappel du jour (l'événement affiché).
   * Ne supprime pas la routine ni les préférences de notification.
   */
  async deleteEvent(userId: string, eventId: string): Promise<boolean> {
    // Un événement déjà « fait » n'est pas supprimable : supprimer puis régénérer (refresh)
    // permettrait de le refaire et de recréditer ses points indéfiniment.
    const deleted = await this.prisma.notificationEvent.deleteMany({
      where: { id: eventId, userId, status: { not: 'done' } },
    });
    return deleted.count > 0;
  }
}
