import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_TIMEZONE,
  addDays,
  dayToUtcMidnight,
  localDay,
  localDayBounds,
  makeLocalTimeResolver,
  resolveTimeZone,
} from '../common/timezone';
import {
  REMINDER_ANCHOR_HOUR,
  medicationOccurrencesOn,
  routineOccurrencesOn,
  routinePlan,
} from '../common/care-occurrences';
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
/** Plafonds de lecture par source (anti-emballement). */
const SOURCE_TAKE = 1000;
/** Fenêtre du flux iCalendar : 7 jours passés + 84 jours à venir = 92 jours. */
const FEED_PAST_DAYS = 7;
const FEED_FUTURE_DAYS = 84;
const TOKEN_REGEX = /^[A-Za-z0-9_-]{20,128}$/;

export interface AgendaRange {
  fromDay: string;
  toDay: string;
  /** Instant UTC du début (minuit local) du premier jour, dans le fuseau de l'utilisateur. */
  start: Date;
  /** Dernier instant (ms) du dernier jour local. */
  end: Date;
}

/** Date calendaire stricte `YYYY-MM-DD` (rejette 2026-02-31), sinon null. */
function parseStrictDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    return null;
  return value;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Période [fromDay ; toDay] en jours LOCAUX du fuseau (bornes = instants UTC). */
function rangeOfDays(
  fromDay: string,
  toDay: string,
  timeZone: string,
): AgendaRange {
  return {
    fromDay,
    toDay,
    start: localDayBounds(fromDay, timeZone).start,
    end: localDayBounds(toDay, timeZone).end,
  };
}

/**
 * Résout et valide la période demandée, en jours LOCAUX de `timeZone` : `from` par défaut =
 * `todayDay` (aujourd'hui local) ; `to` par défaut = `from` + 29 jours. Rejette (400) un
 * format/une date invalide, `to < from` et plus de 92 jours.
 */
export function resolveAgendaRange(
  from: string | undefined,
  to: string | undefined,
  todayDay: string,
  timeZone: string = DEFAULT_TIMEZONE,
): AgendaRange {
  const fromDay = parseStrictDay(from ?? todayDay);
  if (!fromDay)
    throw new BadRequestException(
      'from must be a valid date formatted YYYY-MM-DD',
    );
  const toDay =
    to !== undefined
      ? parseStrictDay(to)
      : addDays(fromDay, DEFAULT_AGENDA_DAYS - 1);
  if (!toDay)
    throw new BadRequestException(
      'to must be a valid date formatted YYYY-MM-DD',
    );
  if (toDay < fromDay) {
    throw new BadRequestException('to must be on or after from');
  }
  const days =
    Math.round((dayToUtcMidnight(toDay) - dayToUtcMidnight(fromDay)) / DAY_MS) +
    1;
  if (days > MAX_AGENDA_DAYS) {
    throw new BadRequestException(
      `The requested period cannot exceed ${MAX_AGENDA_DAYS} days`,
    );
  }
  return rangeOfDays(fromDay, toDay, resolveTimeZone(timeZone));
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
 * Éléments générés jour après jour (ordre chronologique) jusqu'à dépasser `limit` : la mémoire
 * reste bornée (au pire un jour de trop) même pour des routines horaires sur 92 jours.
 */
function collectByDay(
  days: string[],
  limit: number,
  itemsForDay: (day: string) => AgendaItem[],
): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const day of days) {
    out.push(...itemsForDay(day).sort(compareItems));
    if (out.length > limit) break;
  }
  return out;
}

/**
 * Agenda des soins : vue unique des soins à venir pour TOUS les animaux de l'utilisateur.
 *
 * Les occurrences de médicaments et de routines sont calculées avec les mêmes fonctions que le
 * générateur de rappels (`common/care-occurrences`, utilisé aussi par `GradeService`) et dans le
 * même fuseau (`User.timezone`) : l'agenda montre exactement ce qui
 * sera notifié. Le statut (`done` / `skipped`) est repris des `NotificationEvent` déjà générés ;
 * sans événement, l'occurrence est `pending`. Toutes les requêtes sont filtrées par
 * `animal.userId` : isolation stricte entre utilisateurs.
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
    const timeZone = resolveTimeZone(user.timezone);
    const range = resolveAgendaRange(
      from,
      to,
      localDay(now, timeZone),
      timeZone,
    );
    const { items, truncated } = await this.buildItems(
      userId,
      user.locale,
      range,
      timeZone,
    );
    return {
      from: range.fromDay,
      to: range.toDay,
      items,
      truncated,
      // Instant serveur pris AVANT la lecture des soins (W6-07) : l'app le renvoie avec sa
      // couverture locale ; une source modifiée après lui n'est pas réputée programmée.
      generatedAt: now.toISOString(),
    };
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
      select: { id: true, locale: true, timezone: true },
    });
    if (!user) throw new UnauthorizedException('Invalid calendar token');

    const timeZone = resolveTimeZone(user.timezone);
    const today = localDay(now, timeZone);
    const range = rangeOfDays(
      addDays(today, -FEED_PAST_DAYS),
      addDays(today, FEED_FUTURE_DAYS),
      timeZone,
    );
    const { items } = await this.buildItems(
      user.id,
      user.locale,
      range,
      timeZone,
    );
    // Les instants sont émis en UTC (DTSTART:…Z) : corrects quel que soit le fuseau du client.
    return buildIcs(items, { labels: agendaLabels(user.locale), now });
  }

  // ---------------------------------------------------------------------------
  // Agrégation
  // ---------------------------------------------------------------------------

  /**
   * Construit les éléments de la période, au plus `MAX_AGENDA_ITEMS`.
   *
   * Priorité des sources (revue de sécurité, constat 5) : des routines fréquentes (ex. horaires)
   * ne doivent JAMAIS évincer un RDV, un rappel de vaccin ou un médicament. Les sources sont
   * donc servies dans l'ordre RDV → vaccins → médicaments → routines, chacune dans l'ordre
   * chronologique et dans la limite des places restantes ; le tri final mélange le tout par date.
   * `truncated` signale qu'au moins un élément a été omis (réduire la période).
   */
  private async buildItems(
    userId: string,
    locale: string,
    range: AgendaRange,
    timeZone: string,
  ): Promise<{ items: AgendaItem[]; truncated: boolean }> {
    const labels = agendaLabels(locale);
    const resolve = makeLocalTimeResolver(timeZone);
    const { start, end } = range;
    // Champs « date calendaire » (sans heure, stockés à minuit UTC) : bornes calendaires.
    const calStart = new Date(dayToUtcMidnight(range.fromDay));
    const calEnd = new Date(dayToUtcMidnight(range.toDay) + DAY_MS - 1);
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
            startDate: { lte: calEnd },
            OR: [{ endDate: null }, { endDate: { gte: calStart } }],
          },
          include: animalSelect,
          orderBy: { id: 'asc' },
          take: SOURCE_TAKE,
        }),
        this.prisma.vaccination.findMany({
          where: { ...owned, nextDueDate: { gte: calStart, lte: calEnd } },
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

    const makeItem = (
      item: Omit<AgendaItem, 'id' | 'day'>,
      day: string,
    ): AgendaItem => ({
      ...item,
      id: `${item.type}:${item.sourceId}:${item.date}`,
      day,
    });

    // Jours LOCAUX de la période.
    const days: string[] = [];
    for (let d = range.fromDay; d <= range.toDay; d = addDays(d, 1)) {
      days.push(d);
    }

    const out: AgendaItem[] = [];
    let truncated = false;
    /** Ajoute une source (déjà chronologique) dans la limite des places restantes. */
    const take = (items: AgendaItem[], sourceCapped = false): void => {
      const room = MAX_AGENDA_ITEMS - out.length;
      if (items.length > room || sourceCapped) truncated = true;
      out.push(...items.slice(0, Math.max(0, room)));
    };

    // 1. Rendez-vous vétérinaires (programmés, effectués, annulés) : instant, jour local.
    take(
      appointments
        .map((a) =>
          makeItem(
            {
              date: a.date.toISOString(),
              allDay: false,
              type: 'vet_appointment',
              animalId: a.animal.id,
              animalName: a.animal.name,
              title: a.vetName,
              detail:
                [a.reason, a.location]
                  .filter((v): v is string => !!v)
                  .join(' - ') || null,
              status:
                a.status === 'done'
                  ? 'done'
                  : a.status === 'cancelled'
                    ? 'cancelled'
                    : 'pending',
              sourceId: a.id,
            },
            localDay(a.date, timeZone),
          ),
        )
        .sort(compareItems),
      appointments.length >= SOURCE_TAKE * 2,
    );

    // 2. Rappels de vaccin : prochaine échéance (journée entière, date calendaire).
    take(
      vaccinations
        .filter((v) => v.nextDueDate)
        .map((v) => {
          const dayStr = (v.nextDueDate as Date).toISOString().slice(0, 10);
          return makeItem(
            {
              date: `${dayStr}T00:00:00.000Z`,
              allDay: true,
              type: 'vaccination',
              animalId: v.animal.id,
              animalName: v.animal.name,
              title: v.name,
              detail: v.notes ?? null,
              // Le rappel généré est posé à 08:00 (heure locale) du jour d'échéance.
              status: statusOf(
                `vaccination:${v.id}`,
                resolve(dayStr, REMINDER_ANCHOR_HOUR, 0),
              ),
              sourceId: v.id,
            },
            dayStr,
          );
        })
        .sort(compareItems),
      vaccinations.length >= SOURCE_TAKE * 2,
    );

    // 3. Médicaments en cours (actifs, dans [startDate, endDate], dates calendaires) : 08:00
    //    heure locale (comme le rappel généré), ou toutes les N heures depuis 08:00 du 1er jour.
    const meds = medications.map((m) => ({
      m,
      title: `${m.name} (${m.dose}${m.unit ? ` ${m.unit}` : ''})`,
    }));
    take(
      collectByDay(days, MAX_AGENDA_ITEMS - out.length, (day) => {
        const items: AgendaItem[] = [];
        for (const { m, title } of meds) {
          for (const at of medicationOccurrencesOn(m, day, resolve)) {
            items.push(
              makeItem(
                {
                  date: at.toISOString(),
                  allDay: false,
                  type: 'medication',
                  animalId: m.animal.id,
                  animalName: m.animal.name,
                  title,
                  detail: m.notes ?? null,
                  status: statusOf(`medication:${m.id}`, at),
                  sourceId: m.id,
                },
                day,
              ),
            );
          }
        }
        return items;
      }),
    );

    // 4. Routines — mêmes règles de récurrence ET même fuseau que le générateur de rappels.
    const plans = routines.flatMap((r) => {
      const plan = routinePlan(r, timeZone);
      if (!plan) return []; // sans heure : aucun rappel généré non plus
      return [
        { r, plan, title: r.name || labels.routineTypes[r.type] || r.type },
      ];
    });
    take(
      collectByDay(days, MAX_AGENDA_ITEMS - out.length, (day) => {
        const items: AgendaItem[] = [];
        for (const { r, plan, title } of plans) {
          for (const at of routineOccurrencesOn(plan, day, resolve)) {
            items.push(
              makeItem(
                {
                  date: at.toISOString(),
                  allDay: false,
                  type: 'routine',
                  animalId: r.animal.id,
                  animalName: r.animal.name,
                  title,
                  detail: null,
                  status: statusOf(`routine:${r.id}`, at),
                  sourceId: r.id,
                },
                day,
              ),
            );
          }
        }
        return items;
      }),
    );

    out.sort(compareItems);
    return { items: out, truncated };
  }
}
