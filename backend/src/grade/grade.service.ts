import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoutinesService } from '../routines/routines.service';
import {
  addDays,
  localDay,
  localDayBounds,
  makeLocalTimeResolver,
  resolveTimeZone,
} from '../common/timezone';
import {
  REMINDER_ANCHOR_HOUR,
  SCHEDULE_TIME_REGEX,
  matchesSchedule,
  medicationOccurrencesOn,
  normalizeSchedule,
  routineOccurrencesOn,
  routinePlan,
  scheduleOccurrences,
} from '../common/care-occurrences';

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

  /** Fuseau IANA de l'utilisateur (repli Europe/Paris). */
  private async userTimeZone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return resolveTimeZone(user?.timezone);
  }

  /**
   * Événements du jour LOCAL `dateStr` (défaut : aujourd'hui dans le fuseau de l'utilisateur),
   * générés s'ils n'existent pas encore. Les bornes du jour sont celles du jour local (instants
   * UTC de minuit à minuit dans `User.timezone`), comme pour le scheduler et l'agenda.
   */
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
    const timeZone = await this.userTimeZone(userId);
    const day = dateStr ?? localDay(new Date(), timeZone);
    const { start, end } = localDayBounds(day, timeZone);
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
        const candidates = await this.buildCandidateEvents(
          userId,
          day,
          timeZone,
        );
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
   * Construit (sans écrire) la liste des événements du jour local `day`, par ordre de priorité :
   * RDV vétérinaires, rappels de vaccin, médicaments, routines, préférences. Dédoublonnée par
   * (sourceKey, scheduledAt) et plafonnée à MAX_EVENTS_PER_DAY. Heures murales converties dans
   * `timeZone`. Médicaments et routines : instants calculés par `common/care-occurrences` (source
   * unique partagée avec l'Agenda et la couverture locale).
   */
  private async buildCandidateEvents(
    userId: string,
    day: string,
    timeZone: string,
  ): Promise<NewEvent[]> {
    const resolve = makeLocalTimeResolver(timeZone);

    const out: NewEvent[] = [];
    const seen = new Set<string>();
    const push = (ev: NewEvent): void => {
      if (out.length >= MAX_EVENTS_PER_DAY) return;
      const key = `${ev.sourceKey}|${ev.scheduledAt.getTime()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(ev);
    };
    /** Rappels « du jour » (RDV, vaccin) : 08:00 heure locale. */
    const at8 = (): Date => resolve(day, REMINDER_ANCHOR_HOUR, 0);

    // Module A — Événements depuis les RDV vétérinaires (Premium). `date` est un instant : son
    // jour est le jour LOCAL de l'utilisateur.
    const scheduledAppointments = await this.prisma.vetAppointment.findMany({
      where: { status: 'scheduled', animal: { userId } },
      take: MAX_EVENTS_PER_DAY,
    });
    for (const appt of scheduledAppointments) {
      const apptDay = localDay(appt.date, timeZone);

      // Événement du jour du RDV
      if (apptDay === day) {
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
        if (addDays(apptDay, -n) !== day) continue;
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
    // jour où nextDueDate (date calendaire) == aujourd'hui (jour local)
    const vaccinations = await this.prisma.vaccination.findMany({
      where: { animal: { userId }, nextDueDate: { not: null } },
      take: MAX_EVENTS_PER_DAY * 2,
    });
    for (const vac of vaccinations) {
      if (!vac.nextDueDate) continue;
      if (vac.nextDueDate.toISOString().slice(0, 10) !== day) continue;

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

    // Module A — Prises des médicaments actifs (Premium) : MÊME calcul que l'Agenda et que les
    // rappels locaux de l'app (`medicationOccurrencesOn`) — hebdomadaire : uniquement le jour de
    // la semaine du début ; toutes les N heures : grille depuis 08:00 du premier jour.
    const activeMedications = await this.prisma.medication.findMany({
      where: { active: true, animal: { userId } },
      orderBy: { id: 'asc' },
      take: MAX_EVENTS_PER_DAY,
    });
    for (const med of activeMedications) {
      for (const scheduledAt of medicationOccurrencesOn(med, day, resolve)) {
        push({
          userId,
          type: 'medication',
          label: `💊 ${med.name} (${med.dose})`,
          scheduledAt,
          status: 'pending',
          pointsAwarded: 0,
          medicationId: med.id,
          animalId: med.animalId,
          sourceKey: `medication:${med.id}`,
        });
      }
    }

    // Routines (associées aux animaux) — TOUJOURS générées, même sans préférences de
    // notification. MÊME calcul que l'Agenda (`routinePlan` / `routineOccurrencesOn`) : aucune
    // occurrence avant le jour local de création, récurrence ancrée sur ce jour.
    const activeRoutines = await this.routinesService.getActiveRoutines(userId);
    for (const routine of activeRoutines) {
      const plan = routinePlan(routine, timeZone);
      if (!plan) continue; // sans heure : aucun rappel (ni dans l'Agenda)
      const typeLabel =
        routine.name || ROUTINE_TYPE_LABELS[routine.type] || routine.type;
      for (const scheduledAt of routineOccurrencesOn(plan, day, resolve)) {
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

    // Types personnalisés des préférences (absents de l'Agenda).
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
      const prefsAnchor = localDay(prefs.createdAt, timeZone);

      for (const [type, enabled] of Object.entries(types).slice(0, 100)) {
        if (!enabled) continue;
        const sch = normalizeSchedule(rawSchedules[type]);
        const time = sch.time ?? globalStart;
        const rec = sch.recurrence || 'daily';
        if (
          !matchesSchedule({ ...sch, time, recurrence: rec }, day, prefsAnchor)
        )
          continue;

        for (const scheduledAt of scheduleOccurrences(
          sch,
          rec,
          time,
          day,
          resolve,
        )) {
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

    // Ordre de PRIORITÉ (pas chronologique) : l'appelant tronque au budget restant, et des
    // routines ou types personnalisés fréquents ne doivent jamais évincer un RDV, un vaccin ou
    // une prise de médicament (même règle que l'Agenda). La lecture finale est triée par date.
    return out;
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
      // Pas de points hors de la fenêtre [maintenant − 24 h ; maintenant + 24 h] (tolérance de fuseau) :
      // ni pour le futur (« faire » à l'avance les routines des 12 prochains mois), ni pour un
      // événement antidaté (farming). Le passage à « done » reste permis, sans points.
      const delta = ev.scheduledAt.getTime() - Date.now();
      const inPointsWindow = Math.abs(delta) <= 24 * 3600 * 1000;
      const pointsToAdd =
        status === 'done' && ev.routineId && inPointsWindow
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
