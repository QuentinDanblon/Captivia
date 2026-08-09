import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoutinesService } from '../routines/routines.service';

/** Seules les routines (rappels liés à une routine) donnent des points. 2 pts par routine effectuée. */
const POINTS_PER_ROUTINE_DONE = 2;

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
  const currentIndex = GRADE_THRESHOLDS.findIndex((t) => t.grade === currentGrade);
  const currentMin = GRADE_THRESHOLDS[currentIndex].minPoints;
  const nextGrade = getNextGrade(currentGrade);
  const nextMin = nextGrade
    ? GRADE_THRESHOLDS[GRADE_THRESHOLDS.findIndex((t) => t.grade === nextGrade)].minPoints
    : currentMin;
  const pointsInCurrent = points - currentMin;
  const pointsNeededForNext = nextMin - currentMin;
  const progressPercent =
    pointsNeededForNext > 0 ? Math.min(100, (pointsInCurrent / pointsNeededForNext) * 100) : 100;
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

/**
 * Normalise les formats de schedule rencontrés dans le codebase :
 * - frontend (routines + prefs) : { time: '08:00', recurrence: 'daily', weekDay?, dayOfMonth?, date?, intervalHours? }
 * - seed :                        { days: ['tuesday','friday'], time: '19:00' }
 * - ancien format scheduler :     { hour: 8, day: 2, date: 15, hours: [8, 20] }
 */
function normalizeSchedule(raw: unknown): NormalizedSchedule {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  let time: string | undefined = typeof s.time === 'string' ? s.time : undefined;
  if (!time && typeof s.hour === 'number') time = `${s.hour}:00`;
  if (!time && Array.isArray(s.hours) && typeof s.hours[0] === 'number') time = `${s.hours[0]}:00`;

  const weekDay: number | undefined =
    typeof s.weekDay === 'number' ? s.weekDay : typeof s.day === 'number' ? s.day : undefined;

  let days: number[] | undefined;
  if (Array.isArray(s.days)) {
    days = s.days
      .map((d) => (typeof d === 'number' ? d : DAY_NAME_TO_INDEX[String(d).toLowerCase()]))
      .filter((d): d is number => typeof d === 'number');
  }

  return {
    time,
    recurrence: typeof s.recurrence === 'string' ? s.recurrence : undefined,
    date: typeof s.date === 'string' ? s.date : s.date != null ? String(s.date) : undefined,
    weekDay,
    dayOfMonth: typeof s.dayOfMonth === 'number' ? s.dayOfMonth : undefined,
    intervalHours: typeof s.intervalHours === 'number' ? s.intervalHours : undefined,
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

  async getOrCreateTodayEvents(userId: string, dateStr?: string, refresh = false): Promise<
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

    let events = await this.prisma.notificationEvent.findMany({
      where: { userId, scheduledAt: { gte: start, lte: end } },
      orderBy: { scheduledAt: 'asc' },
    });

    if (refresh && events.length > 0) {
      await this.prisma.notificationEvent.deleteMany({
        where: { userId, scheduledAt: { gte: start, lte: end } },
      });
      events = [];
    }

    if (events.length === 0) {
      const todayStr = date.toISOString().slice(0, 10);
      const dayOfWeek = date.getUTCDay();
      const dayOfMonth = date.getUTCDate();
      const daysSinceEpoch = Math.floor(date.getTime() / 86400000);

      const prefs = await this.prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (prefs?.types && typeof prefs.types === 'object') {
        const types = prefs.types as Record<string, boolean>;
        const rawSchedules =
          prefs.typeSchedules && typeof prefs.typeSchedules === 'object'
            ? (prefs.typeSchedules as Record<string, unknown>)
            : {};
        const globalStart =
          prefs.schedule &&
          typeof prefs.schedule === 'object' &&
          typeof (prefs.schedule as { start?: unknown }).start === 'string'
            ? (prefs.schedule as { start: string }).start
            : '08:00';

        for (const [type, enabled] of Object.entries(types)) {
          if (!enabled) continue;
          const sch = normalizeSchedule(rawSchedules[type]);
          const time = sch.time ?? globalStart;
          const rec = sch.recurrence || 'daily';
          if (!matchesSchedule({ ...sch, time, recurrence: rec }, todayStr, dayOfWeek, dayOfMonth, daysSinceEpoch)) continue;

          if (rec === 'hourly') {
            const interval = Math.max(1, Math.min(24, sch.intervalHours ?? 2));
            const [startH] = (time || '08:00').split(':').map(Number);
            for (let hour = startH; hour < 24; hour += interval) {
              const scheduledAt = new Date(date);
              scheduledAt.setUTCHours(hour, 0, 0, 0);
              const created = await this.prisma.notificationEvent.create({
                data: {
                  userId,
                  type,
                  label: type,
                  scheduledAt,
                  status: 'pending',
                },
              });
              events = [...events, created];
            }
          } else {
            const [h, m] = (time || '08:00').split(':').map(Number);
            const scheduledAt = new Date(date);
            scheduledAt.setUTCHours(h, m || 0, 0, 0);
            const created = await this.prisma.notificationEvent.create({
              data: {
                userId,
                type,
                label: type,
                scheduledAt,
                status: 'pending',
              },
            });
            events = [...events, created];
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
        if (!matchesSchedule({ ...sch, time, recurrence: rec }, todayStr, dayOfWeek, dayOfMonth, daysSinceEpoch)) continue;

          const typeLabel = routine.name || ROUTINE_TYPE_LABELS[routine.type] || routine.type;
          const animal = (routine as any).animal;

          if (rec === 'hourly') {
            const interval = Math.max(1, Math.min(24, sch.intervalHours ?? 2));
            const [startH] = (time || '08:00').split(':').map(Number);
            for (let hour = startH; hour < 24; hour += interval) {
              const scheduledAt = new Date(date);
              scheduledAt.setUTCHours(hour, 0, 0, 0);
              const created = await this.prisma.notificationEvent.create({
                data: {
                  userId,
                  type: routine.type,
                  label: typeLabel,
                  scheduledAt,
                  status: 'pending',
                  routineId: routine.id,
                  animalId: routine.animalId,
                },
              });
              events = [...events, created];
            }
          } else {
            const [h, m] = (time || '08:00').split(':').map(Number);
            const scheduledAt = new Date(date);
            scheduledAt.setUTCHours(h, m || 0, 0, 0);
            const created = await this.prisma.notificationEvent.create({
              data: {
                userId,
                type: routine.type,
                label: typeLabel,
                scheduledAt,
                status: 'pending',
                routineId: routine.id,
                animalId: routine.animalId,
              },
            });
            events = [...events, created];
          }
      }

      // Clés anti-doublon : type + refId + scheduledAt, pour les événements créés
      // dans cette passe (la journée était vide, seuls les doublons intra-passe
      // sont possibles, ex. rappel J-0 + événement du jour du RDV).
      const createdKeys = new Set<string>();

      // Module A — Événements depuis les médicaments actifs (Premium)
      const activeMedications = await this.prisma.medication.findMany({
        where: { active: true, animal: { userId } },
      });
      for (const med of activeMedications) {
        const startDay = med.startDate.toISOString().slice(0, 10);
        const endDay = med.endDate ? med.endDate.toISOString().slice(0, 10) : null;
        if (startDay > todayStr) continue;
        if (endDay && endDay < todayStr) continue;

        const scheduledAt = new Date(date);
        scheduledAt.setUTCHours(8, 0, 0, 0);
        const key = `medication:${med.id}:${scheduledAt.getTime()}`;
        if (createdKeys.has(key)) continue;
        createdKeys.add(key);
        const created = await this.prisma.notificationEvent.create({
          data: {
            userId,
            type: 'medication',
            label: `💊 ${med.name} (${med.dose})`,
            scheduledAt,
            status: 'pending',
            pointsAwarded: 0,
            medicationId: med.id,
            animalId: med.animalId,
          },
        });
        events = [...events, created];
      }

      // Module A — Événements depuis les RDV vétérinaires (Premium)
      const scheduledAppointments = await this.prisma.vetAppointment.findMany({
        where: { status: 'scheduled', animal: { userId } },
      });
      for (const appt of scheduledAppointments) {
        const apptDay = appt.date.toISOString().slice(0, 10);
        const scheduledAt = new Date(date);
        scheduledAt.setUTCHours(8, 0, 0, 0);

        // Événement du jour du RDV
        if (apptDay === todayStr) {
          const key = `vet_appointment:${appt.id}:${scheduledAt.getTime()}`;
          if (!createdKeys.has(key)) {
            createdKeys.add(key);
            const created = await this.prisma.notificationEvent.create({
              data: {
                userId,
                type: 'vet_appointment',
                label: `🏥 RDV ${appt.vetName}`,
                scheduledAt,
                status: 'pending',
                pointsAwarded: 0,
                appointmentId: appt.id,
                animalId: appt.animalId,
              },
            });
            events = [...events, created];
          }
        }

        // Rappels J-N (reminderDays jours avant le RDV)
        for (const n of appt.reminderDays ?? []) {
          const reminderDate = new Date(appt.date);
          reminderDate.setUTCDate(reminderDate.getUTCDate() - n);
          if (reminderDate.toISOString().slice(0, 10) !== todayStr) continue;
          const key = `vet_appointment:${appt.id}:${scheduledAt.getTime()}`;
          if (createdKeys.has(key)) continue; // ex. rappel J-0 déjà couvert par l'événement du jour
          createdKeys.add(key);
          const created = await this.prisma.notificationEvent.create({
            data: {
              userId,
              type: 'vet_appointment',
              label: `🔔 ${appt.vetName} (J-${n})`,
              scheduledAt,
              status: 'pending',
              pointsAwarded: 0,
              appointmentId: appt.id,
              animalId: appt.animalId,
            },
          });
          events = [...events, created];
        }
      }

      // Module C — Événements de rappel vaccin (Premium) : un rappel est créé le
      // jour où nextDueDate == aujourd'hui (anti-doublon par type+vaccinationId+scheduledAt)
      const vaccinations = await this.prisma.vaccination.findMany({
        where: { animal: { userId } },
      });
      for (const vac of vaccinations) {
        if (!vac.nextDueDate) continue;
        if (vac.nextDueDate.toISOString().slice(0, 10) !== todayStr) continue;

        const scheduledAt = new Date(date);
        scheduledAt.setUTCHours(8, 0, 0, 0);
        const key = `vaccination:${vac.id}:${scheduledAt.getTime()}`;
        if (createdKeys.has(key)) continue;
        createdKeys.add(key);
        const created = await this.prisma.notificationEvent.create({
          data: {
            userId,
            type: 'vaccination',
            label: `💉 Rappel vaccin ${vac.name}`,
            scheduledAt,
            status: 'pending',
            pointsAwarded: 0,
            vaccinationId: vac.id,
            animalId: vac.animalId,
          },
        });
        events = [...events, created];
      }

      events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
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

  async setEventStatus(
    userId: string,
    eventId: string,
    status: 'done' | 'skipped',
  ): Promise<{ event: unknown; grade: unknown } | null> {
    const ev = await this.prisma.notificationEvent.findFirst({
      where: { id: eventId, userId },
    });
    if (!ev || ev.status !== 'pending') return null;

    // Seules les routines (ev.routineId) donnent des points. Les notifications seules n'en donnent pas.
    const pointsToAdd =
      status === 'done' && ev.routineId ? POINTS_PER_ROUTINE_DONE : 0;
    await this.prisma.notificationEvent.update({
      where: { id: eventId },
      data: { status, pointsAwarded: pointsToAdd },
    });

    if (pointsToAdd > 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
      const newPoints = (user?.points ?? 0) + pointsToAdd;
      const newGrade = pointsToGrade(newPoints);
      await this.prisma.user.update({
        where: { id: userId },
        data: { points: newPoints, grade: newGrade },
      });
    }

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
    const deleted = await this.prisma.notificationEvent.deleteMany({
      where: { id: eventId, userId },
    });
    return deleted.count > 0;
  }
}
