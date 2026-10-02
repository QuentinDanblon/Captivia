import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { localDay } from '../notifications/notifications-scheduler.service';
import {
  matchesSchedule,
  normalizeSchedule,
  scheduleOccurrences,
} from '../grade/grade.service';
import { agendaLabels } from './agenda.labels';
import { buildIcs } from './ics';
import type {
  AgendaItem,
  AgendaItemStatus,
  AgendaResult,
} from './agenda.types';

const DAY_MS = 86_400_000;
/** Amplitude maximale d'une requête (jours, bornes incluses) : un trimestre civil. */
export const MAX_AGENDA_DAYS = 92;
/** Période par défaut quand `to` est omis (jours, bornes incluses). */
export const DEFAULT_AGENDA_DAYS = 30;
/** Nombre maximal d'éléments renvoyés (au-delà : `truncated: true`). */
export const MAX_AGENDA_ITEMS = 2500;
/** Tampon de construction (les occurrences au-delà sont ignorées avant tri). */
const BUILD_BUFFER = 10_000;
/** Plafonds de lecture par source (anti-emballement). */
const SOURCE_TAKE = 1000;
const MED_ANCHOR_HOUR = 8;
/** Fenêtre du flux iCalendar : 7 jours passés + 84 jours à venir = 92 jours. */
const FEED_PAST_DAYS = 7;
const FEED_FUTURE_DAYS = 84;
const TOKEN_REGEX = /^[A-Za-z0-9_-]{20,128}$/;

export interface AgendaRange {
  fromDay: string;
  toDay: string;
  /** 00:00:00.000Z du premier jour. */
  start: Date;
  /** 23:59:59.999Z du dernier jour. */
  end: Date;
}

/** Date calendaire stricte `YYYY-MM-DD` (rejette 2026-02-31) → minuit UTC, sinon null. */
function parseStrictDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    return null;
  return d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Résout et valide la période demandée. `from` par défaut = `todayDay` ; `to` par défaut =
 * `from` + 29 jours. Rejette (400) un format/une date invalide, `to < from` et plus de 92 jours.
 */
export function resolveAgendaRange(
  from: string | undefined,
  to: string | undefined,
  todayDay: string,
): AgendaRange {
  const fromDate = parseStrictDay(from ?? todayDay);
  if (!fromDate)
    throw new BadRequestException(
      'from must be a valid date formatted YYYY-MM-DD',
    );
  const toDate =
    to !== undefined
      ? parseStrictDay(to)
      : addDays(fromDate, DEFAULT_AGENDA_DAYS - 1);
  if (!toDate)
    throw new BadRequestException(
      'to must be a valid date formatted YYYY-MM-DD',
    );
  if (toDate.getTime() < fromDate.getTime()) {
    throw new BadRequestException('to must be on or after from');
  }
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  if (days > MAX_AGENDA_DAYS) {
    throw new BadRequestException(
      `The requested period cannot exceed ${MAX_AGENDA_DAYS} days`,
    );
  }
  return {
    fromDay: fromDate.toISOString().slice(0, 10),
    toDay: toDate.toISOString().slice(0, 10),
    start: fromDate,
    end: new Date(toDate.getTime() + DAY_MS - 1),
  };
}

const TYPE_ORDER: Record<AgendaItem['type'], number> = {
  vet_appointment: 0,
  medication: 1,
  routine: 2,
  vaccination: 3,
};

function compareItems(a: AgendaItem, b: AgendaItem): number {
  return (
    a.date.localeCompare(b.date) ||
    TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
    a.animalName.localeCompare(b.animalName) ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Agenda des soins : vue unique des soins à venir pour TOUS les animaux de l'utilisateur.
 *
 * Les occurrences de routines sont calculées avec les mêmes fonctions que le générateur de rappels
 * (`GradeService`) : l'agenda montre exactement ce qui sera notifié. Le statut (`done` / `skipped`)
 * est repris des `NotificationEvent` déjà générés ; sans événement, l'occurrence est `pending`.
 * Toutes les requêtes sont filtrées par `animal.userId` : isolation stricte entre utilisateurs.
 */
@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  async getAgenda(
    userId: string,
    from?: string,
    to?: string,
    now: Date = new Date(),
  ): Promise<AgendaResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true, timezone: true },
    });
    if (!user) throw new UnauthorizedException();
    const range = resolveAgendaRange(from, to, localDay(now, user.timezone));
    const { items, truncated } = await this.buildItems(
      userId,
      user.locale,
      range,
    );
    return { from: range.fromDay, to: range.toDay, items, truncated };
  }

  // ---------------------------------------------------------------------------
  // Jeton de flux iCalendar (personnel, révocable, stocké haché)
  // ---------------------------------------------------------------------------

  async hasCalendarToken(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { calendarToken: true },
    });
    return !!user?.calendarToken;
  }

  /** (Re)génère le jeton : l'éventuel ancien lien cesse immédiatement de fonctionner. */
  async regenerateCalendarToken(
    userId: string,
  ): Promise<{ token: string; feedPath: string }> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: hashToken(token) },
    });
    return { token, feedPath: `/users/me/agenda.ics?token=${token}` };
  }

  async revokeCalendarToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: null },
    });
  }

  /** Flux iCalendar d'un jeton ; 401 si le jeton est absent, mal formé, inconnu ou révoqué. */
  async getFeedByToken(
    token: string | undefined,
    now: Date = new Date(),
  ): Promise<string> {
    if (!token || !TOKEN_REGEX.test(token))
      throw new UnauthorizedException('Invalid calendar token');
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: hashToken(token) },
      select: { id: true, locale: true },
    });
    if (!user) throw new UnauthorizedException('Invalid calendar token');

    const today = parseStrictDay(now.toISOString().slice(0, 10)) as Date;
    const start = addDays(today, -FEED_PAST_DAYS);
    const last = addDays(today, FEED_FUTURE_DAYS);
    const range: AgendaRange = {
      fromDay: start.toISOString().slice(0, 10),
      toDay: last.toISOString().slice(0, 10),
      start,
      end: new Date(last.getTime() + DAY_MS - 1),
    };
    const { items } = await this.buildItems(user.id, user.locale, range);
    return buildIcs(items, { labels: agendaLabels(user.locale), now });
  }

  // ---------------------------------------------------------------------------
  // Agrégation
  // ---------------------------------------------------------------------------

  private async buildItems(
    userId: string,
    locale: string,
    range: AgendaRange,
  ): Promise<{ items: AgendaItem[]; truncated: boolean }> {
    const labels = agendaLabels(locale);
    const { start, end } = range;
    const owned = { animal: { userId } };
    const animalSelect = {
      animal: { select: { id: true, name: true } },
    } as const;

    const [routines, medications, vaccinations, appointments, events] =
      await Promise.all([
        this.prisma.routine.findMany({
          where: { active: true, ...owned },
          include: animalSelect,
          orderBy: { id: 'asc' },
          take: SOURCE_TAKE,
        }),
        this.prisma.medication.findMany({
          where: {
            active: true,
            ...owned,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
          },
          include: animalSelect,
          orderBy: { id: 'asc' },
          take: SOURCE_TAKE,
        }),
        this.prisma.vaccination.findMany({
          where: { ...owned, nextDueDate: { gte: start, lte: end } },
          include: animalSelect,
          orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }],
          take: SOURCE_TAKE * 2,
        }),
        this.prisma.vetAppointment.findMany({
          where: { ...owned, date: { gte: start, lte: end } },
          include: animalSelect,
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          take: SOURCE_TAKE * 2,
        }),
        this.prisma.notificationEvent.findMany({
          where: {
            userId,
            sourceKey: { not: null },
            scheduledAt: { gte: start, lte: end },
          },
          select: { sourceKey: true, scheduledAt: true, status: true },
          take: 20_000,
        }),
      ]);

    const statusByEvent = new Map<string, AgendaItemStatus>();
    for (const e of events) {
      const status: AgendaItemStatus =
        e.status === 'done'
          ? 'done'
          : e.status === 'skipped'
            ? 'skipped'
            : 'pending';
      statusByEvent.set(`${e.sourceKey}|${e.scheduledAt.getTime()}`, status);
    }
    const statusOf = (sourceKey: string, at: Date): AgendaItemStatus =>
      statusByEvent.get(`${sourceKey}|${at.getTime()}`) ?? 'pending';

    const out: AgendaItem[] = [];
    const push = (item: Omit<AgendaItem, 'id' | 'day'>): void => {
      if (out.length >= BUILD_BUFFER) return;
      out.push({
        ...item,
        id: `${item.type}:${item.sourceId}:${item.date}`,
        day: item.date.slice(0, 10),
      });
    };

    // Jours de la période (minuit UTC).
    const days: Date[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS)
      days.push(new Date(t));

    // 1. Routines — mêmes règles de récurrence que le générateur de rappels.
    for (const r of routines) {
      const sch = normalizeSchedule(r.schedule);
      if (!sch.time) continue; // sans heure : aucun rappel généré non plus
      const rec = sch.recurrence || r.frequency || 'daily';
      const createdDay = r.createdAt.toISOString().slice(0, 10);
      const title = r.name || labels.routineTypes[r.type] || r.type;
      for (const day of days) {
        const dayStr = day.toISOString().slice(0, 10);
        if (dayStr < createdDay) continue;
        const matches = matchesSchedule(
          { ...sch, time: sch.time, recurrence: rec },
          dayStr,
          day.getUTCDay(),
          day.getUTCDate(),
          Math.floor(day.getTime() / DAY_MS),
        );
        if (!matches) continue;
        for (const at of scheduleOccurrences(sch, rec, sch.time, day)) {
          push({
            date: at.toISOString(),
            allDay: false,
            type: 'routine',
            animalId: r.animal.id,
            animalName: r.animal.name,
            title,
            detail: null,
            status: statusOf(`routine:${r.id}`, at),
            sourceId: r.id,
          });
        }
      }
    }

    // 2. Médicaments en cours (actifs, dans [startDate, endDate]).
    for (const m of medications) {
      const startDay = parseStrictDay(
        m.startDate.toISOString().slice(0, 10),
      ) as Date;
      const lastMs = m.endDate
        ? (
            parseStrictDay(m.endDate.toISOString().slice(0, 10)) as Date
          ).getTime() +
          DAY_MS -
          1
        : Number.POSITIVE_INFINITY;
      const title = `${m.name} (${m.dose}${m.unit ? ` ${m.unit}` : ''})`;
      const base = {
        allDay: false,
        type: 'medication' as const,
        animalId: m.animal.id,
        animalName: m.animal.name,
        title,
        detail: m.notes ?? null,
        sourceId: m.id,
      };
      const anchor = startDay.getTime() + MED_ANCHOR_HOUR * 3_600_000;
      const emit = (ms: number): void => {
        if (
          ms < start.getTime() ||
          ms > end.getTime() ||
          ms > lastMs ||
          ms < startDay.getTime()
        )
          return;
        const at = new Date(ms);
        push({
          ...base,
          date: at.toISOString(),
          status: statusOf(`medication:${m.id}`, at),
        });
      };

      if (
        m.frequency === 'every_x_hours' &&
        m.intervalHours &&
        m.intervalHours > 0
      ) {
        const step = m.intervalHours * 3_600_000;
        const k0 =
          start.getTime() > anchor
            ? Math.ceil((start.getTime() - anchor) / step)
            : 0;
        for (
          let ms = anchor + k0 * step;
          ms <= end.getTime() && ms <= lastMs;
          ms += step
        )
          emit(ms);
      } else {
        for (const day of days) {
          if (
            m.frequency === 'weekly' &&
            day.getUTCDay() !== startDay.getUTCDay()
          )
            continue;
          emit(day.getTime() + MED_ANCHOR_HOUR * 3_600_000);
        }
      }
    }

    // 3. Rappels de vaccin : prochaine échéance (journée entière).
    for (const v of vaccinations) {
      if (!v.nextDueDate) continue;
      const dayStr = v.nextDueDate.toISOString().slice(0, 10);
      const dayStart = new Date(`${dayStr}T00:00:00.000Z`);
      push({
        date: dayStart.toISOString(),
        allDay: true,
        type: 'vaccination',
        animalId: v.animal.id,
        animalName: v.animal.name,
        title: v.name,
        detail: v.notes ?? null,
        // Le rappel généré est posé à 08:00 UTC du jour d'échéance.
        status: statusOf(
          `vaccination:${v.id}`,
          new Date(dayStart.getTime() + MED_ANCHOR_HOUR * 3_600_000),
        ),
        sourceId: v.id,
      });
    }

    // 4. Rendez-vous vétérinaires (programmés, effectués, annulés).
    for (const a of appointments) {
      const status: AgendaItemStatus =
        a.status === 'done'
          ? 'done'
          : a.status === 'cancelled'
            ? 'cancelled'
            : 'pending';
      push({
        date: a.date.toISOString(),
        allDay: false,
        type: 'vet_appointment',
        animalId: a.animal.id,
        animalName: a.animal.name,
        title: a.vetName,
        detail:
          [a.reason, a.location].filter((v): v is string => !!v).join(' - ') ||
          null,
        status,
        sourceId: a.id,
      });
    }

    out.sort(compareItems);
    const truncated = out.length > MAX_AGENDA_ITEMS;
    return {
      items: truncated ? out.slice(0, MAX_AGENDA_ITEMS) : out,
      truncated,
    };
  }
}
