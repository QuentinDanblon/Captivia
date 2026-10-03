/**
 * Rappels en notifications locales dans l'app native (W6-06).
 *
 * L'agenda des 30 prochains jours (routines, médicaments, rappels de vaccin, rendez-vous
 * vétérinaires — API `/users/me/agenda`) est programmé sur l'appareil avec
 * `@capacitor/local-notifications` : les rappels sonnent même sans réseau.
 *
 * - Identifiants stables : hachage de l'identifiant d'agenda (`<type>:<source>:<instant>`), le même
 *   soin garde le même numéro d'une synchronisation à l'autre (remplacement, pas de doublon).
 * - Au plus 64 rappels en attente (limite iOS) : les plus proches.
 * - Hors ligne : dernière liste connue (Preferences), propre au compte.
 * - Coupés depuis les paramètres de notifications : tout est annulé, plus rien n'est programmé.
 * - Permission demandée seulement sur demande explicite (bouton des paramètres) ou juste après une
 *   connexion quand il y a des soins à rappeler — jamais au lancement à froid.
 *
 * Plugins importés à la demande : rien dans le bundle web, aucun effet hors de l'app native.
 */
import { AgendaApiError, fetchAgenda, rangeFromToday, type AgendaItem } from './agenda';
import { getPlatform, isNative } from './platform';

/** Horizon programmé sur l'appareil. */
export const REMINDER_HORIZON_DAYS = 30;
/** iOS ne garde que 64 notifications locales en attente par app. */
export const MAX_PENDING_REMINDERS = 64;
/** Échéance « journée entière » (vaccin, rendez-vous sans heure) : rappel à 9 h, heure locale. */
export const ALL_DAY_REMINDER_HOUR = 9;
/** Canal Android des rappels. */
export const REMINDER_CHANNEL_ID = 'captivia-reminders';
/** Marque des notifications programmées par Captivia (champ `extra.kind`). */
export const REMINDER_KIND = 'captivia-agenda';

const PREF_ENABLED = 'captivia.reminders.enabled';
const PREF_CACHE = 'captivia.reminders.cache';
const PREF_IDS = 'captivia.reminders.ids';
const PREF_ASKED = 'captivia.reminders.asked';

const MAX_ID = 0x7fffffff;

// ---------------------------------------------------------------------------
// Planification (pure)
// ---------------------------------------------------------------------------

/**
 * Identifiant de notification stable (entier 32 bits positif, exigé par Android) : FNV-1a de la clé.
 */
export function reminderId(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % MAX_ID) + 1;
}

/** Instant du rappel : l'heure du soin, ou 9 h locale le jour d'une échéance sans heure. */
export function reminderFireDate(item: AgendaItem): Date | null {
  if (item.allDay) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.day);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), ALL_DAY_REMINDER_HOUR, 0, 0, 0);
  }
  const at = new Date(item.date);
  return Number.isNaN(at.getTime()) ? null : at;
}

export interface PlannedReminder {
  id: number;
  /** Identifiant d'agenda (`<type>:<source>:<instant>`). */
  key: string;
  at: Date;
  item: AgendaItem;
}

/**
 * Rappels à programmer : soins « à faire » à venir, sans doublon, triés par date, au plus `limit`
 * (les plus proches). En cas de collision de hachage (rarissime), l'identifiant suivant libre est
 * pris, dans l'ordre chronologique.
 */
export function planReminders(
  items: readonly AgendaItem[],
  { now = new Date(), limit = MAX_PENDING_REMINDERS }: { now?: Date; limit?: number } = {},
): PlannedReminder[] {
  const seen = new Set<string>();
  const candidates: { key: string; at: Date; item: AgendaItem }[] = [];
  for (const item of items) {
    if (!item || item.status !== 'pending' || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const at = reminderFireDate(item);
    if (!at || at.getTime() <= now.getTime()) continue;
    candidates.push({ key: item.id, at, item });
  }
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const used = new Set<number>();
  return candidates.slice(0, Math.max(0, limit)).map((c) => {
    let id = reminderId(c.key);
    while (used.has(id)) id = (id % MAX_ID) + 1;
    used.add(id);
    return { id, key: c.key, at: c.at, item: c.item };
  });
}

/** Identifiants programmés auparavant qui ne font plus partie du plan (à annuler). */
export function staleReminderIds(previous: Iterable<number>, planned: readonly PlannedReminder[]): number[] {
  const keep = new Set(planned.map((p) => p.id));
  return [...new Set(previous)].filter((id) => Number.isInteger(id) && !keep.has(id));
}

// ---------------------------------------------------------------------------
// Plugins (natif uniquement)
// ---------------------------------------------------------------------------

type LocalNotificationsApi = typeof import('@capacitor/local-notifications').LocalNotifications;
type PreferencesApi = typeof import('@capacitor/preferences').Preferences;

const loadNotifications = (): Promise<LocalNotificationsApi> =>
  import('@capacitor/local-notifications').then((m) => m.LocalNotifications);
const loadPreferences = (): Promise<PreferencesApi> => import('@capacitor/preferences').then((m) => m.Preferences);

async function prefGet(key: string): Promise<string | null> {
  try {
    return (await (await loadPreferences()).get({ key })).value;
  } catch {
    return null;
  }
}

async function prefSet(key: string, value: string | null): Promise<void> {
  try {
    const prefs = await loadPreferences();
    if (value === null) await prefs.remove({ key });
    else await prefs.set({ key, value });
  } catch {
    // stockage indisponible : la prochaine synchronisation repartira de zéro
  }
}

interface ReminderCache {
  userId: string;
  savedAt: string;
  items: AgendaItem[];
}

async function readCache(userId: string): Promise<AgendaItem[] | null> {
  const raw = await prefGet(PREF_CACHE);
  if (!raw) return null;
  try {
    const cache = JSON.parse(raw) as ReminderCache;
    return cache && cache.userId === userId && Array.isArray(cache.items) ? cache.items : null;
  } catch {
    return null;
  }
}

async function readStoredIds(): Promise<number[]> {
  const raw = await prefGet(PREF_IDS);
  if (!raw) return [];
  try {
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

/** Identifiants des rappels Captivia en attente sur l'appareil (marqués + mémorisés). */
async function managedPendingIds(ln: LocalNotificationsApi): Promise<number[]> {
  const ids = new Set(await readStoredIds());
  try {
    const { notifications } = await ln.getPending();
    for (const n of notifications) {
      if ((n.extra as { kind?: unknown } | undefined)?.kind === REMINDER_KIND) ids.add(n.id);
    }
  } catch {
    // liste indisponible : on s'en tient aux identifiants mémorisés
  }
  return [...ids];
}

async function cancelIds(ln: LocalNotificationsApi, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await ln.cancel({ notifications: ids.map((id) => ({ id })) });
}

/** Rappels coupés par l'utilisateur sur cet appareil ? (actifs par défaut) */
export async function areLocalRemindersEnabled(): Promise<boolean> {
  return (await prefGet(PREF_ENABLED)) !== '0';
}

export type ReminderPermission = 'granted' | 'denied' | 'prompt';

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!isNative()) return 'denied';
  try {
    const { display } = await (await loadNotifications()).checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

/** Nombre de rappels Captivia actuellement programmés sur l'appareil. */
export async function countScheduledReminders(): Promise<number> {
  if (!isNative()) return 0;
  try {
    const { notifications } = await (await loadNotifications()).getPending();
    return notifications.filter((n) => (n.extra as { kind?: unknown } | undefined)?.kind === REMINDER_KIND).length;
  } catch {
    return 0;
  }
}

/** Annule tous les rappels Captivia programmés (rappels coupés, déconnexion). */
export async function cancelAllLocalReminders(): Promise<void> {
  if (!isNative()) return;
  try {
    const ln = await loadNotifications();
    await cancelIds(ln, await managedPendingIds(ln));
  } catch {
    // plugin indisponible : rien à annuler
  }
  await prefSet(PREF_IDS, null);
}

/** Déconnexion : annule les rappels et oublie la liste du compte. */
export async function clearLocalReminders(): Promise<void> {
  if (!isNative()) return;
  await cancelAllLocalReminders();
  await prefSet(PREF_CACHE, null);
}

/** Coupe (false) ou rétablit (true) les rappels sur cet appareil. Couper annule tout. */
export async function setLocalRemindersEnabled(enabled: boolean): Promise<void> {
  await prefSet(PREF_ENABLED, enabled ? '1' : '0');
  if (!enabled) await cancelAllLocalReminders();
}

export interface ReminderTexts {
  /** Titre et texte de la notification d'un soin. */
  format: (item: AgendaItem) => { title: string; body: string };
  /** Nom et description du canal Android. */
  channelName: string;
  channelDescription: string;
}

export interface SyncOptions {
  token: string;
  userId: string;
  texts: ReminderTexts;
  /**
   * Autorise la demande de permission si elle n'a jamais été posée : juste après une connexion
   * (une seule fois par appareil), ou `'always'` sur action explicite (bouton des paramètres).
   */
  prompt?: false | 'once' | 'always';
  now?: Date;
}

export type SyncOutcome = 'scheduled' | 'disabled' | 'no-permission' | 'unavailable' | 'unsupported';

export interface SyncResult {
  outcome: SyncOutcome;
  /** Rappels programmés. */
  count: number;
  /** Provenance de la liste : réseau ou dernière liste connue. */
  source: 'network' | 'cache' | null;
}

let syncChain: Promise<unknown> = Promise.resolve();

/**
 * (Re)programme les rappels du compte. Sans effet hors de l'app native. Les appels sont
 * sérialisés (connexion, retour au premier plan et paramètres peuvent se chevaucher).
 */
export function syncLocalReminders(options: SyncOptions): Promise<SyncResult> {
  const run = syncChain.then(
    () => doSync(options),
    () => doSync(options),
  );
  syncChain = run.catch(() => undefined);
  return run;
}

async function doSync({ token, userId, texts, prompt = false, now = new Date() }: SyncOptions): Promise<SyncResult> {
  if (!isNative()) return { outcome: 'unsupported', count: 0, source: null };
  if (!(await areLocalRemindersEnabled())) {
    await cancelAllLocalReminders();
    return { outcome: 'disabled', count: 0, source: null };
  }

  // 1. Agenda des 30 prochains jours ; hors ligne (ou serveur indisponible) : dernière liste connue.
  let items: AgendaItem[] | null = null;
  let source: SyncResult['source'] = null;
  try {
    const { from, to } = rangeFromToday(REMINDER_HORIZON_DAYS, now);
    items = (await fetchAgenda(token, from, to)).items;
    source = 'network';
    await prefSet(PREF_CACHE, JSON.stringify({ userId, savedAt: now.toISOString(), items } satisfies ReminderCache));
  } catch (err) {
    // 401/403 : session perdue ou refusée, on ne reprogramme pas une liste peut-être périmée.
    const status = err instanceof AgendaApiError ? err.status : 0;
    if (status === 0 || status >= 500 || status === 408 || status === 429) {
      items = await readCache(userId);
      source = items ? 'cache' : null;
    }
  }
  if (!items) return { outcome: 'unavailable', count: 0, source: null };

  const planned = planReminders(items, { now });

  // 2. Permission : jamais demandée au lancement à froid ni sans soin à rappeler.
  let ln: LocalNotificationsApi;
  try {
    ln = await loadNotifications();
  } catch {
    return { outcome: 'unsupported', count: 0, source };
  }
  let permission = (await ln.checkPermissions()).display;
  if (permission !== 'granted' && permission !== 'denied' && planned.length > 0) {
    const mayAsk = prompt === 'always' || (prompt === 'once' && (await prefGet(PREF_ASKED)) !== '1');
    if (mayAsk) {
      await prefSet(PREF_ASKED, '1');
      permission = (await ln.requestPermissions()).display;
    }
  }
  if (permission !== 'granted') return { outcome: 'no-permission', count: 0, source };

  // 3. Canal Android (idempotent).
  if (getPlatform() === 'android') {
    try {
      await ln.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: texts.channelName,
        description: texts.channelDescription,
        importance: 4,
        visibility: 1,
      });
    } catch {
      // canal par défaut
    }
  }

  // 4. Annule les rappels qui ne sont plus au programme, puis (re)programme : un identifiant déjà
  //    en attente est remplacé (même soin, texte ou heure à jour).
  await cancelIds(ln, staleReminderIds(await managedPendingIds(ln), planned));
  if (planned.length) {
    await ln.schedule({
      notifications: planned.map((p) => {
        const { title, body } = texts.format(p.item);
        return {
          id: p.id,
          title,
          body,
          schedule: { at: p.at, allowWhileIdle: true },
          channelId: REMINDER_CHANNEL_ID,
          extra: { kind: REMINDER_KIND, key: p.key, animalId: p.item.animalId, type: p.item.type },
        };
      }),
    });
  }
  await prefSet(PREF_IDS, JSON.stringify(planned.map((p) => p.id)));
  return { outcome: 'scheduled', count: planned.length, source };
}

/** Animal visé par une notification Captivia touchée (`extra.animalId`), sinon null. */
export function reminderAnimalId(extra: unknown): string | null {
  if (!extra || typeof extra !== 'object') return null;
  const { kind, animalId } = extra as { kind?: unknown; animalId?: unknown };
  return kind === REMINDER_KIND && typeof animalId === 'string' && animalId ? animalId : null;
}
