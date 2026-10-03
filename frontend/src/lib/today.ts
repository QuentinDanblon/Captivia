/**
 * Tableau de bord « Aujourd'hui » et fiche animal : fonctions pures (alertes graduées, statut
 * des soins, dernière pesée, conseil « Bon à savoir », âge, poids). Aucun appel réseau ici :
 * les pages chargent les données, ce module les interprète (testé dans lib/__tests__/today.test.ts).
 */
import type { AnimalMeasurement, Medication, Vaccination, VetAppointment } from './api';
import { currentMedications } from './carnet';
import { displayDay, type AgendaItem } from './agenda';
import { localDayKey } from './dates';
import type { CareStatus } from '@/components/ui/CareTimeline';

const DAY_MS = 86_400_000;

/** Seuils (jours) des alertes : rappel de vaccin proche, pesée à refaire, pesée très ancienne. */
export const VACCINE_SOON_DAYS = 30;
export const WEIGHING_STALE_DAYS = 30;
export const WEIGHING_OLD_DAYS = 90;

function time(value: string | null | undefined): number {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? NaN : ms;
}

/** Début du jour local de `date`. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Écart en jours calendaires locaux entre `now` et `value` (positif = dans le futur). */
export function daysFrom(value: string | Date, now: Date = new Date()): number {
  const d = value instanceof Date ? value : new Date(value);
  return Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Agenda → frise
// ---------------------------------------------------------------------------

/**
 * Statut d'un soin de l'agenda pour la frise : fait, sauté, en retard (échéance passée encore à
 * faire), à faire aujourd'hui, prévu plus tard.
 */
export function careStatusOf(item: AgendaItem, now: Date = new Date()): CareStatus {
  if (item.status === 'done') return 'done';
  if (item.status === 'skipped' || item.status === 'cancelled') return 'skipped';
  const today = localDayKey(now);
  const day = displayDay(item);
  if (day < today) return 'overdue';
  if (day > today) return 'planned';
  // Aujourd'hui : une prise à heure fixe dépassée depuis plus d'une heure est en retard.
  if (!item.allDay && time(item.date) < now.getTime() - 3_600_000) return 'overdue';
  return 'due';
}

export interface DaySummary {
  /** Soins du jour restant à faire. */
  due: number;
  /** Soins en retard (jours précédents ou heure dépassée). */
  overdue: number;
  /** Soins du jour déjà faits. */
  done: number;
  /** Rendez-vous vétérinaires à venir sur la période. */
  appointments: number;
}

export function summarizeAgenda(items: AgendaItem[], now: Date = new Date()): DaySummary {
  const summary: DaySummary = { due: 0, overdue: 0, done: 0, appointments: 0 };
  const today = localDayKey(now);
  for (const item of items) {
    const status = careStatusOf(item, now);
    if (status === 'overdue') summary.overdue++;
    else if (status === 'due') summary.due++;
    else if (status === 'done' && displayDay(item) === today) summary.done++;
    if (item.type === 'vet_appointment' && (status === 'planned' || status === 'due')) summary.appointments++;
  }
  return summary;
}

/** Frise : retards d'abord (au plus `overdueLimit`), puis le jour et les jours suivants, triés. */
export function timelineItems(items: AgendaItem[], now: Date = new Date(), limit = 8): AgendaItem[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const overdue = sorted.filter((i) => careStatusOf(i, now) === 'overdue');
  const rest = sorted.filter((i) => careStatusOf(i, now) !== 'overdue');
  return [...overdue.slice(-3), ...rest].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Alertes graduées
// ---------------------------------------------------------------------------

export type AlertKind = 'vaccineOverdue' | 'vaccineSoon' | 'treatment' | 'weighingOld' | 'weighingStale' | 'weighingNone';
export type AlertLevel = 'urgent' | 'warning' | 'info';

export interface AnimalAlert {
  kind: AlertKind;
  level: AlertLevel;
  animalId: string;
  animalName: string;
  /** Vaccin ou traitement concerné. */
  subject?: string;
  /** Date de référence (rappel, fin de traitement, dernière pesée). */
  date?: string;
  /** Jours avant (positif) ou depuis (négatif) la date de référence. */
  days?: number;
}

const LEVEL_RANK: Record<AlertLevel, number> = { urgent: 0, warning: 1, info: 2 };

export interface AlertInput {
  animal: { id: string; name: string };
  vaccinations?: Vaccination[] | null;
  medications?: Medication[] | null;
  measurements?: AnimalMeasurement[] | null;
}

/**
 * Alertes d'un animal, de la plus grave à la plus légère :
 *  - rappel de vaccin dépassé → urgent ; dans les 30 jours → à prévoir ;
 *  - traitement en cours → information ;
 *  - dernière pesée > 90 jours → à prévoir ; > 30 jours → information.
 * Une collection `null` (non chargée, verrouillée) ne produit aucune alerte.
 */
export function animalAlerts({ animal, vaccinations, medications, measurements }: AlertInput, now: Date = new Date()): AnimalAlert[] {
  const base = { animalId: animal.id, animalName: animal.name };
  const alerts: AnimalAlert[] = [];

  // Un rappel par nom de vaccin : le plus récent fait foi.
  const latestByVaccine = new Map<string, Vaccination>();
  for (const v of vaccinations ?? []) {
    const key = v.name.trim().toLowerCase();
    const previous = latestByVaccine.get(key);
    if (!previous || time(v.date) > time(previous.date)) latestByVaccine.set(key, v);
  }
  for (const v of latestByVaccine.values()) {
    if (!v.nextDueDate || Number.isNaN(time(v.nextDueDate))) continue;
    const days = daysFrom(v.nextDueDate, now);
    if (days < 0) alerts.push({ ...base, kind: 'vaccineOverdue', level: 'urgent', subject: v.name, date: v.nextDueDate, days });
    else if (days <= VACCINE_SOON_DAYS) alerts.push({ ...base, kind: 'vaccineSoon', level: 'warning', subject: v.name, date: v.nextDueDate, days });
  }

  if (medications) {
    for (const m of currentMedications(medications, now)) {
      if (time(m.startDate) > now.getTime()) continue;
      alerts.push({ ...base, kind: 'treatment', level: 'info', subject: m.name, date: m.endDate ?? undefined, days: m.endDate ? daysFrom(m.endDate, now) : undefined });
    }
  }

  if (measurements) {
    const last = lastWeighing(measurements);
    if (last) {
      const days = -daysFrom(last.measuredAt, now);
      if (days > WEIGHING_OLD_DAYS) alerts.push({ ...base, kind: 'weighingOld', level: 'warning', date: last.measuredAt, days: -days });
      else if (days > WEIGHING_STALE_DAYS) alerts.push({ ...base, kind: 'weighingStale', level: 'info', date: last.measuredAt, days: -days });
    } else {
      alerts.push({ ...base, kind: 'weighingNone', level: 'info' });
    }
  }

  return sortAlerts(alerts);
}

/** Tri par gravité, puis par échéance la plus proche (retards les plus anciens d'abord). */
export function sortAlerts(alerts: AnimalAlert[]): AnimalAlert[] {
  return [...alerts].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || (a.days ?? 0) - (b.days ?? 0));
}

// ---------------------------------------------------------------------------
// Mesures, âge, rendez-vous
// ---------------------------------------------------------------------------

/** Dernière mesure portant un poids (ou null). */
export function lastWeighing(measurements: AnimalMeasurement[]): (AnimalMeasurement & { weightKg: number }) | null {
  let best: (AnimalMeasurement & { weightKg: number }) | null = null;
  for (const m of measurements) {
    if (typeof m.weightKg !== 'number' || Number.isNaN(time(m.measuredAt))) continue;
    if (!best || time(m.measuredAt) > time(best.measuredAt)) best = m as AnimalMeasurement & { weightKg: number };
  }
  return best;
}

/** Variation entre les deux dernières pesées, en kg (null s'il en manque une). */
export function weightTrend(measurements: AnimalMeasurement[]): number | null {
  const weighed = measurements
    .filter((m) => typeof m.weightKg === 'number' && !Number.isNaN(time(m.measuredAt)))
    .sort((a, b) => time(b.measuredAt) - time(a.measuredAt));
  if (weighed.length < 2) return null;
  return Math.round(((weighed[0].weightKg as number) - (weighed[1].weightKg as number)) * 1000) / 1000;
}

/**
 * Poids lisible dans la locale : en grammes sous 10 kg (« 2 340 g », l'unité des reptiles et des
 * oiseaux), en kilogrammes au-delà (« 12,5 kg »).
 */
export function formatWeight(kg: number, locale: string, signed = false): string {
  const grams = Math.abs(kg) < 10;
  const value = grams ? Math.round(kg * 1000) : Math.round(kg * 10) / 10;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: grams ? 'gram' : 'kilogram',
    unitDisplay: 'short',
    maximumFractionDigits: grams ? 0 : 1,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);
}

/** Âge en années révolues, ou en mois sous un an (null sans date de naissance valide). */
export function ageOf(birthDate: string | null | undefined, now: Date = new Date()): { value: number; unit: 'year' | 'month' } | null {
  const ms = time(birthDate);
  if (Number.isNaN(ms) || ms > now.getTime()) return null;
  const birth = new Date(ms);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  months = Math.max(0, months);
  return months >= 12 ? { value: Math.floor(months / 12), unit: 'year' } : { value: months, unit: 'month' };
}

export function formatAge(age: { value: number; unit: 'year' | 'month' }, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'unit', unit: age.unit, unitDisplay: 'long' }).format(age.value);
}

/** « il y a 12 jours », « aujourd'hui », « dans 3 jours » (Intl.RelativeTimeFormat). */
export function formatRelativeDays(days: number, locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
}

/** Prochain rendez-vous vétérinaire prévu (statut `scheduled`, date à venir). */
export function nextAppointment(appointments: VetAppointment[], now: Date = new Date()): VetAppointment | null {
  return (
    [...appointments]
      .filter((a) => a.status === 'scheduled' && time(a.date) >= now.getTime() - 3_600_000)
      .sort((a, b) => time(a.date) - time(b.date))[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Fiche espèce : nom, binôme latin, conseil
// ---------------------------------------------------------------------------

export interface SpeciesSheet {
  key?: number;
  scientificName?: string;
  canonicalName?: string;
  vernacularName?: string;
  class?: string;
  profile?: { commonNameFr?: string | null; category?: string | null; description?: string | null } | null;
  habitat?: { temperature?: string | null; humidity?: string | null } | null;
}

export interface SpeciesHealthSheet {
  editorial?: { diseases?: Array<{ name: string; prevention?: string; whenToConsult?: string }> };
}

/** Binôme latin sans l'autorité (« Boa constrictor Linnaeus, 1758 » → « Boa constrictor »). */
export function latinName(species: SpeciesSheet | null | undefined, fallback?: string): string | undefined {
  if (species?.canonicalName) return species.canonicalName;
  const raw = species?.scientificName ?? fallback;
  if (!raw) return undefined;
  const words = raw.trim().split(/\s+/);
  return words.slice(0, words[2] && /^[a-z]/.test(words[2]) ? 3 : 2).join(' ');
}

/** Nom commun dans la langue de l'utilisateur, s'il est connu (le profil éditorial est en français). */
export function commonName(species: SpeciesSheet | null | undefined, locale: string): string | undefined {
  if (!species) return undefined;
  if (locale === 'fr' && species.profile?.commonNameFr) return species.profile.commonNameFr;
  return species.vernacularName || undefined;
}

export type SpeciesTip =
  | { kind: 'prevention'; text: string; topic: string }
  | { kind: 'habitat'; temperature?: string; humidity?: string };

/**
 * Conseil « Bon à savoir » tiré de la fiche espèce : la prévention de la première affection
 * décrite, sinon les repères d'ambiance (température, hygrométrie). Null s'il n'y a rien de sourcé.
 */
export function speciesTip(species: SpeciesSheet | null | undefined, health: SpeciesHealthSheet | null | undefined): SpeciesTip | null {
  const disease = health?.editorial?.diseases?.find((d) => d.prevention?.trim());
  if (disease?.prevention) return { kind: 'prevention', text: disease.prevention.trim(), topic: disease.name };
  const temperature = species?.habitat?.temperature?.trim() || undefined;
  const humidity = species?.habitat?.humidity?.trim() || undefined;
  if (temperature || humidity) return { kind: 'habitat', temperature, humidity };
  return null;
}

// ---------------------------------------------------------------------------
// Frise de la fiche animal (à partir des données déjà chargées par la fiche)
// ---------------------------------------------------------------------------

export type SheetEventKind = 'visit' | 'vaccine' | 'vaccineDue' | 'weighing' | 'health' | 'treatmentStart' | 'treatmentEnd';

export interface SheetEvent {
  id: string;
  /** Instant ISO ; pour une date sans heure, midi local du jour (aucun décalage de fuseau). */
  date: string;
  allDay: boolean;
  title: string;
  detail?: string;
  status: CareStatus;
  kind: SheetEventKind;
}

export interface SheetTimelineInput {
  vetAppointments: VetAppointment[];
  vaccinations: Vaccination[];
  measurements: AnimalMeasurement[];
  healthRecords: Array<{ id: string; title: string; date: string; notes?: string | null }>;
  medications: Medication[];
}

/** Date calendaire (champ « date » de l'API, stocké à minuit UTC) → midi local du même jour. */
function calendarNoon(value: string): string {
  return `${value.slice(0, 10)}T12:00:00`;
}

/**
 * Frise de la fiche : les 3 derniers repères (pesée, vaccin, acte de santé, rendez-vous passé)
 * puis les 5 prochaines échéances (rendez-vous, rappels de vaccin, fin de traitement), dans
 * l'ordre chronologique. `weight` met en forme les pesées dans la locale de l'utilisateur.
 */
export function sheetTimeline(
  { vetAppointments, vaccinations, measurements, healthRecords, medications }: SheetTimelineInput,
  now: Date = new Date(),
  weight: (kg: number) => string = (kg) => `${kg} kg`,
): SheetEvent[] {
  const events: SheetEvent[] = [];
  const statusOf = (date: string, allDay: boolean): CareStatus => {
    const days = daysFrom(new Date(date), now);
    if (days > 0) return 'planned';
    if (days < 0) return 'overdue';
    return allDay || time(date) >= now.getTime() - 3_600_000 ? 'due' : 'overdue';
  };

  for (const a of vetAppointments) {
    if (Number.isNaN(time(a.date))) continue;
    const status: CareStatus = a.status === 'done' ? 'done' : a.status === 'cancelled' ? 'skipped' : statusOf(a.date, false);
    // Un rendez-vous passé resté « prévu » n'est signalé que la semaine qui suit.
    if (status === 'overdue' && daysFrom(a.date, now) < -7) continue;
    events.push({ id: `visit-${a.id}`, date: a.date, allDay: false, title: a.vetName, detail: a.reason ?? a.location ?? undefined, status, kind: 'visit' });
  }
  for (const v of vaccinations) {
    if (!Number.isNaN(time(v.date))) {
      events.push({ id: `vaccine-${v.id}`, date: calendarNoon(v.date), allDay: true, title: v.name, detail: v.vetName ?? undefined, status: 'done', kind: 'vaccine' });
    }
    if (v.nextDueDate && !Number.isNaN(time(v.nextDueDate))) {
      const date = calendarNoon(v.nextDueDate);
      events.push({ id: `vaccine-due-${v.id}`, date, allDay: true, title: v.name, status: statusOf(date, true), kind: 'vaccineDue' });
    }
  }
  for (const m of measurements) {
    if (typeof m.weightKg !== 'number' || Number.isNaN(time(m.measuredAt))) continue;
    events.push({ id: `weighing-${m.id}`, date: calendarNoon(m.measuredAt), allDay: true, title: weight(m.weightKg), detail: m.notes ?? undefined, status: 'done', kind: 'weighing' });
  }
  for (const r of healthRecords) {
    if (Number.isNaN(time(r.date))) continue;
    events.push({ id: `health-${r.id}`, date: calendarNoon(r.date), allDay: true, title: r.title, status: 'done', kind: 'health' });
  }
  for (const m of medications) {
    if (!m.active) continue;
    if (!Number.isNaN(time(m.startDate))) {
      const date = calendarNoon(m.startDate);
      const started = daysFrom(new Date(date), now) <= 0;
      const detail = [m.dose, m.unit].filter(Boolean).join(' ') || undefined;
      events.push({ id: `treatment-start-${m.id}`, date, allDay: true, title: m.name, detail, status: started ? 'done' : 'planned', kind: 'treatmentStart' });
    }
    if (m.endDate && !Number.isNaN(time(m.endDate))) {
      const date = calendarNoon(m.endDate);
      const days = daysFrom(new Date(date), now);
      events.push({ id: `treatment-end-${m.id}`, date, allDay: true, title: m.name, status: days > 0 ? 'planned' : days === 0 ? 'due' : 'done', kind: 'treatmentEnd' });
    }
  }

  const byDate = (a: SheetEvent, b: SheetEvent) => time(a.date) - time(b.date) || a.id.localeCompare(b.id);
  const ahead = events.filter((e) => e.status === 'planned' || e.status === 'due' || e.status === 'overdue').sort(byDate);
  const behind = events.filter((e) => e.status === 'done' || e.status === 'skipped').sort(byDate);
  return [...behind.slice(-3), ...ahead.slice(0, 5)].sort(byDate);
}
