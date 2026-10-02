/**
 * Agenda des soins : appels API (liste agrégée + jeton de flux iCalendar) et utilitaires purs
 * (période, filtres, regroupement par jour). Fichier indépendant de lib/api.ts.
 */

import { API_URL } from './config';

export type AgendaItemType = 'routine' | 'medication' | 'vaccination' | 'vet_appointment';
export type AgendaItemStatus = 'pending' | 'done' | 'skipped' | 'cancelled';

export const AGENDA_TYPES: AgendaItemType[] = ['routine', 'medication', 'vaccination', 'vet_appointment'];

export interface AgendaItem {
  id: string;
  /** Instant ISO 8601 (UTC). */
  date: string;
  /** Jour YYYY-MM-DD (UTC) de `date` ; sert de jour d'affichage des échéances « journée entière ». */
  day: string;
  allDay: boolean;
  type: AgendaItemType;
  animalId: string;
  animalName: string;
  title: string;
  detail: string | null;
  status: AgendaItemStatus;
  sourceId: string;
}

export interface AgendaResponse {
  from: string;
  to: string;
  items: AgendaItem[];
  truncated: boolean;
}

export class AgendaApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgendaApiError';
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function agendaFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AgendaApiError('network', 0);
  }
  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) throw new AgendaApiError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

export function fetchAgenda(token: string, from: string, to: string): Promise<AgendaResponse> {
  const qs = new URLSearchParams({ from, to });
  return agendaFetch<AgendaResponse>(`/users/me/agenda?${qs.toString()}`, token);
}

export function getCalendarTokenStatus(token: string): Promise<{ active: boolean }> {
  return agendaFetch('/users/me/agenda/calendar-token', token);
}

export function regenerateCalendarToken(token: string): Promise<{ active: boolean; token: string; feedPath: string }> {
  return agendaFetch('/users/me/agenda/calendar-token', token, { method: 'POST' });
}

export function revokeCalendarToken(token: string): Promise<{ active: boolean }> {
  return agendaFetch('/users/me/agenda/calendar-token', token, { method: 'DELETE' });
}

/** URL absolue du flux ICS à partir du `feedPath` renvoyé par l'API. */
export function buildFeedUrl(feedPath: string): string {
  return `${API_URL}${feedPath}`;
}

// ---------------------------------------------------------------------------
// Utilitaires purs
// ---------------------------------------------------------------------------

const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` du jour LOCAL de `date` (le navigateur de l'utilisateur fait foi). */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Période [aujourd'hui local ; aujourd'hui + days − 1] au format attendu par l'API (≤ 92 jours). */
export function rangeFromToday(days: number, now: Date = new Date()): { from: string; to: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days - 1);
  return { from: localDayKey(now), to: localDayKey(end) };
}

/** Jour d'affichage d'un élément : `day` pour une échéance sans heure, sinon jour local de l'instant. */
export function displayDay(item: AgendaItem): string {
  return item.allDay ? item.day : localDayKey(new Date(item.date));
}

export interface AgendaFilters {
  animalId: string;
  type: AgendaItemType | '';
}

export function filterItems(items: AgendaItem[], filters: AgendaFilters): AgendaItem[] {
  return items.filter(
    (i) => (!filters.animalId || i.animalId === filters.animalId) && (!filters.type || i.type === filters.type),
  );
}

export interface DayGroup {
  day: string;
  items: AgendaItem[];
}

/** Regroupe par jour d'affichage ; jours triés, journées entières en tête puis par heure. */
export function groupByDay(items: AgendaItem[]): DayGroup[] {
  const map = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = displayDay(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      items: [...list].sort(
        (a, b) => Number(b.allDay) - Number(a.allDay) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      ),
    }));
}

/** Animaux distincts présents dans la liste, triés par nom. */
export function distinctAnimals(items: AgendaItem[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const i of items) map.set(i.animalId, i.animalName);
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
