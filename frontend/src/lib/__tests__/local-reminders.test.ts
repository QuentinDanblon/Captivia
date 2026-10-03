import type { AgendaItem } from '../agenda';

// --- Plugins mockés -----------------------------------------------------------
type Pending = { id: number; title?: string; extra?: Record<string, unknown> };
const ln = {
  pending: [] as Pending[],
  permission: 'granted' as string,
  afterRequest: 'granted' as string,
  checkPermissions: jest.fn(async () => ({ display: ln.permission })),
  requestPermissions: jest.fn(async () => {
    ln.permission = ln.afterRequest;
    return { display: ln.permission };
  }),
  getPending: jest.fn(async () => ({ notifications: ln.pending.map((n) => ({ ...n })) })),
  cancel: jest.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
    const ids = new Set(notifications.map((n) => n.id));
    ln.pending = ln.pending.filter((n) => !ids.has(n.id));
  }),
  schedule: jest.fn(async ({ notifications }: { notifications: Pending[] }) => {
    for (const n of notifications) {
      ln.pending = ln.pending.filter((p) => p.id !== n.id);
      ln.pending.push(n);
    }
    return { notifications: notifications.map((n) => ({ id: n.id })) };
  }),
  createChannel: jest.fn(async () => undefined),
};
jest.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));

const prefs = new Map<string, string>();
jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.has(key) ? prefs.get(key)! : null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
  },
}));

const mockIsNative = jest.fn(() => true);
const mockPlatform = jest.fn(() => 'ios');
jest.mock('../platform', () => ({
  isNative: () => mockIsNative(),
  getPlatform: () => mockPlatform(),
}));

const mockFetchAgenda = jest.fn();
jest.mock('../agenda', () => {
  const actual = jest.requireActual('../agenda');
  return { ...actual, fetchAgenda: (...args: unknown[]) => mockFetchAgenda(...args) };
});

import { AgendaApiError } from '../agenda';
import {
  ALL_DAY_REMINDER_HOUR,
  MAX_PENDING_REMINDERS,
  REMINDER_CHANNEL_ID,
  REMINDER_KIND,
  areLocalRemindersEnabled,
  cancelAllLocalReminders,
  clearLocalReminders,
  countScheduledReminders,
  getReminderPermission,
  planReminders,
  reminderAnimalId,
  reminderFireDate,
  reminderId,
  setLocalRemindersEnabled,
  staleReminderIds,
  syncLocalReminders,
  type ReminderTexts,
} from '../local-reminders';

// --- Données ------------------------------------------------------------------
const NOW = new Date(2026, 9, 3, 12, 0, 0); // 3 oct. 2026, 12:00 locale

function item(partial: Partial<AgendaItem> & { at?: Date }): AgendaItem {
  const at = partial.at ?? new Date(2026, 9, 4, 8, 0, 0);
  const sourceId = partial.sourceId ?? 'r1';
  const type = partial.type ?? 'routine';
  return {
    id: partial.id ?? `${type}:${sourceId}:${at.toISOString()}`,
    date: partial.date ?? at.toISOString(),
    day: partial.day ?? '2026-10-04',
    allDay: partial.allDay ?? false,
    type,
    animalId: partial.animalId ?? 'a1',
    animalName: partial.animalName ?? 'Kaa',
    title: partial.title ?? 'Nourrissage',
    detail: null,
    status: partial.status ?? 'pending',
    sourceId,
  };
}

/** n soins horaires à partir de demain 00:00, un par heure. */
function hourly(n: number, offset = 0): AgendaItem[] {
  return Array.from({ length: n }, (_, i) =>
    item({ sourceId: 'h', at: new Date(2026, 9, 4, 0 + i + offset, 0, 0) }),
  );
}

const texts: ReminderTexts = {
  format: (i) => ({ title: i.animalName, body: `${i.type}: ${i.title}` }),
  channelName: 'Rappels de soins',
  channelDescription: 'desc',
};

const sync = (extra: Partial<Parameters<typeof syncLocalReminders>[0]> = {}) =>
  syncLocalReminders({ token: 'jwt', userId: 'u1', texts, now: NOW, ...extra });

beforeEach(() => {
  ln.pending = [];
  ln.permission = 'granted';
  ln.afterRequest = 'granted';
  prefs.clear();
  jest.clearAllMocks();
  mockIsNative.mockReturnValue(true);
  mockPlatform.mockReturnValue('ios');
});

// --- Fonctions pures ----------------------------------------------------------
describe('reminderId', () => {
  it('est stable, entier positif sur 31 bits', () => {
    const key = 'routine:r1:2026-10-04T06:00:00.000Z';
    expect(reminderId(key)).toBe(reminderId(key));
    for (const k of ['', 'a', key, 'x'.repeat(500)]) {
      const id = reminderId(k);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
      expect(id).toBeLessThanOrEqual(0x7fffffff);
    }
  });

  it('distingue des soins différents', () => {
    const ids = new Set(hourly(500).map((i) => reminderId(i.id)));
    expect(ids.size).toBe(500);
  });
});

describe('reminderFireDate', () => {
  it("heure du soin pour un élément horodaté", () => {
    const at = new Date(2026, 9, 4, 14, 30);
    expect(reminderFireDate(item({ at }))?.getTime()).toBe(at.getTime());
  });

  it('9 h locale le jour d’une échéance sans heure', () => {
    const d = reminderFireDate(item({ allDay: true, day: '2026-10-10', date: '2026-10-10T00:00:00.000Z' }))!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026,
      9,
      10,
      ALL_DAY_REMINDER_HOUR,
      0,
    ]);
  });

  it('null pour une date illisible', () => {
    expect(reminderFireDate(item({ allDay: true, day: '10/10/2026' }))).toBeNull();
    expect(reminderFireDate(item({ date: 'n/a' }))).toBeNull();
  });
});

describe('planReminders', () => {
  it('garde les soins à faire à venir, triés par date', () => {
    const later = item({ sourceId: 'b', at: new Date(2026, 9, 6, 8) });
    const sooner = item({ sourceId: 'a', at: new Date(2026, 9, 5, 8) });
    const done = item({ sourceId: 'c', status: 'done' });
    const skipped = item({ sourceId: 'd', status: 'skipped' });
    const cancelled = item({ sourceId: 'e', status: 'cancelled' });
    const past = item({ sourceId: 'f', at: new Date(2026, 9, 3, 11, 59) });
    const plan = planReminders([later, done, past, sooner, skipped, cancelled], { now: NOW });
    expect(plan.map((p) => p.key)).toEqual([sooner.id, later.id]);
    expect(plan[0].id).toBe(reminderId(sooner.id));
  });

  it('dédoublonne un même soin renvoyé deux fois', () => {
    const a = item({ sourceId: 'a' });
    const plan = planReminders([a, { ...a }, { ...a, title: 'autre' }], { now: NOW });
    expect(plan).toHaveLength(1);
    expect(plan[0].item.title).toBe('Nourrissage');
  });

  it('respecte la limite iOS de 64 en gardant les plus proches', () => {
    const items = hourly(100).reverse();
    const plan = planReminders(items, { now: NOW });
    expect(MAX_PENDING_REMINDERS).toBe(64);
    expect(plan).toHaveLength(64);
    expect(plan[0].at.getHours()).toBe(0);
    expect(plan[63].at.getTime()).toBe(new Date(2026, 9, 4, 63, 0, 0).getTime());
    const last = Math.max(...plan.map((p) => p.at.getTime()));
    expect(items.filter((i) => new Date(i.date).getTime() > last)).toHaveLength(36);
  });

  it('limite configurable, jamais négative', () => {
    expect(planReminders(hourly(10), { now: NOW, limit: 3 })).toHaveLength(3);
    expect(planReminders(hourly(10), { now: NOW, limit: -1 })).toHaveLength(0);
  });

  it('identifiants uniques même en cas de collision de hachage', () => {
    // Deux clés dont le FNV-1a (mod 2^31 − 1) coïncide.
    const k1 = 'routine:r9468:2026-10-05T08:00:00.000Z';
    const k2 = 'routine:r210262:2026-10-05T08:00:00.000Z';
    expect(reminderId(k1)).toBe(reminderId(k2));
    const a = item({ id: k1, at: new Date(2026, 9, 5, 8) });
    const b = item({ id: k2, at: new Date(2026, 9, 5, 9) });
    const plan = planReminders([b, a], { now: NOW });
    expect(plan.map((p) => p.id)).toEqual([reminderId(k1), reminderId(k1) + 1]);
  });

  it('ignore les éléments sans identifiant', () => {
    expect(planReminders([item({ id: '' })], { now: NOW })).toEqual([]);
  });
});

describe('staleReminderIds', () => {
  it('liste les anciens identifiants absents du nouveau plan, sans doublon', () => {
    const plan = planReminders(hourly(2), { now: NOW });
    expect(staleReminderIds([plan[0].id, 7, 7, 8], plan)).toEqual([7, 8]);
    expect(staleReminderIds([], plan)).toEqual([]);
  });
});

describe('reminderAnimalId', () => {
  it('lit l’animal des seules notifications Captivia', () => {
    expect(reminderAnimalId({ kind: REMINDER_KIND, animalId: 'a1' })).toBe('a1');
    expect(reminderAnimalId({ kind: 'autre', animalId: 'a1' })).toBeNull();
    expect(reminderAnimalId({ kind: REMINDER_KIND, animalId: 3 })).toBeNull();
    expect(reminderAnimalId(null)).toBeNull();
    expect(reminderAnimalId('x')).toBeNull();
  });
});

// --- Synchronisation (plugins mockés) -------------------------------------------
describe('syncLocalReminders', () => {
  it('programme l’agenda des 30 prochains jours avec des identifiants stables', async () => {
    const items = [item({ sourceId: 'a' }), item({ sourceId: 'b', type: 'medication', animalId: 'a2', at: new Date(2026, 9, 4, 20) })];
    mockFetchAgenda.mockResolvedValue({ items, from: '', to: '', truncated: false });
    const res = await sync();
    expect(res).toEqual({ outcome: 'scheduled', count: 2, source: 'network' });
    expect(mockFetchAgenda).toHaveBeenCalledWith('jwt', '2026-10-03', '2026-11-01');
    const scheduled = ln.schedule.mock.calls[0][0].notifications;
    expect(scheduled.map((n: Pending) => n.id)).toEqual(items.map((i) => reminderId(i.id)));
    expect(scheduled[1]).toMatchObject({
      title: 'Kaa',
      body: 'medication: Nourrissage',
      channelId: REMINDER_CHANNEL_ID,
      extra: { kind: REMINDER_KIND, animalId: 'a2', key: items[1].id, type: 'medication' },
      schedule: { allowWhileIdle: true },
    });

    // Deuxième passage : mêmes identifiants, aucun doublon en attente.
    await sync();
    expect(ln.pending).toHaveLength(2);
    expect(ln.schedule.mock.calls[1][0].notifications.map((n: Pending) => n.id)).toEqual(
      scheduled.map((n: Pending) => n.id),
    );
    expect(ln.cancel).not.toHaveBeenCalled();
  });

  it('annule les rappels qui ne sont plus au programme, sans toucher aux autres notifications', async () => {
    const a = item({ sourceId: 'a' });
    const b = item({ sourceId: 'b' });
    mockFetchAgenda.mockResolvedValueOnce({ items: [a, b] });
    await sync();
    ln.pending.push({ id: 42, extra: { kind: 'autre' } });
    mockFetchAgenda.mockResolvedValueOnce({ items: [a] });
    await sync();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: reminderId(b.id) }] });
    expect(ln.pending.map((n) => n.id).sort()).toEqual([42, reminderId(a.id)].sort());
  });

  it('annule aussi un rappel marqué Captivia inconnu de la liste mémorisée', async () => {
    ln.pending.push({ id: 5, extra: { kind: REMINDER_KIND } });
    mockFetchAgenda.mockResolvedValue({ items: [] });
    const res = await sync();
    expect(res.count).toBe(0);
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 5 }] });
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('ne programme jamais plus de 64 rappels', async () => {
    mockFetchAgenda.mockResolvedValue({ items: hourly(200) });
    const res = await sync();
    expect(res.count).toBe(64);
    expect(ln.schedule.mock.calls[0][0].notifications).toHaveLength(64);
  });

  it('hors ligne : reprend la dernière liste connue du même compte', async () => {
    const a = item({ sourceId: 'a' });
    mockFetchAgenda.mockResolvedValueOnce({ items: [a] });
    await sync();
    mockFetchAgenda.mockRejectedValueOnce(new AgendaApiError('network', 0));
    const res = await sync();
    expect(res).toEqual({ outcome: 'scheduled', count: 1, source: 'cache' });

    mockFetchAgenda.mockRejectedValueOnce(new AgendaApiError('HTTP 503', 503));
    expect((await sync()).source).toBe('cache');

    mockFetchAgenda.mockRejectedValueOnce(new AgendaApiError('network', 0));
    expect(await sync({ userId: 'u2' })).toEqual({ outcome: 'unavailable', count: 0, source: null });
  });

  it('hors ligne : les soins passés de la liste mémorisée ne sont plus programmés', async () => {
    mockFetchAgenda.mockResolvedValueOnce({ items: hourly(5) });
    await sync();
    mockFetchAgenda.mockRejectedValueOnce(new AgendaApiError('network', 0));
    const res = await sync({ now: new Date(2026, 9, 4, 2, 30) });
    expect(res.count).toBe(2);
  });

  it('session refusée (401) : ne reprogramme rien', async () => {
    mockFetchAgenda.mockResolvedValueOnce({ items: [item({})] });
    await sync();
    jest.clearAllMocks();
    mockFetchAgenda.mockRejectedValueOnce(new AgendaApiError('HTTP 401', 401));
    expect((await sync()).outcome).toBe('unavailable');
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(ln.cancel).not.toHaveBeenCalled();
  });

  it('rappels coupés : tout est annulé et rien n’est programmé', async () => {
    mockFetchAgenda.mockResolvedValue({ items: hourly(3) });
    await sync();
    expect(await countScheduledReminders()).toBe(3);
    await setLocalRemindersEnabled(false);
    expect(await areLocalRemindersEnabled()).toBe(false);
    expect(ln.pending).toHaveLength(0);
    ln.schedule.mockClear();
    expect(await sync()).toEqual({ outcome: 'disabled', count: 0, source: null });
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(mockFetchAgenda).toHaveBeenCalledTimes(1);

    await setLocalRemindersEnabled(true);
    expect((await sync()).count).toBe(3);
  });

  describe('permission', () => {
    beforeEach(() => {
      ln.permission = 'prompt';
      mockFetchAgenda.mockResolvedValue({ items: [item({})] });
    });

    it("n'est jamais demandée sans autorisation explicite (lancement à froid, retour au premier plan)", async () => {
      expect((await sync()).outcome).toBe('no-permission');
      expect(ln.requestPermissions).not.toHaveBeenCalled();
      expect(ln.schedule).not.toHaveBeenCalled();
    });

    it('après une connexion : demandée une seule fois par appareil', async () => {
      expect((await sync({ prompt: 'once' })).outcome).toBe('scheduled');
      expect(ln.requestPermissions).toHaveBeenCalledTimes(1);

      ln.permission = 'prompt';
      ln.afterRequest = 'denied';
      expect((await sync({ prompt: 'once' })).outcome).toBe('no-permission');
      expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
    });

    it('sur action explicite : demandée à nouveau', async () => {
      ln.afterRequest = 'denied';
      await sync({ prompt: 'once' });
      ln.permission = 'prompt-with-rationale';
      ln.afterRequest = 'granted';
      expect((await sync({ prompt: 'always' })).outcome).toBe('scheduled');
      expect(ln.requestPermissions).toHaveBeenCalledTimes(2);
    });

    it('jamais demandée quand il n’y a rien à rappeler', async () => {
      mockFetchAgenda.mockResolvedValue({ items: [item({ status: 'done' })] });
      await sync({ prompt: 'always' });
      expect(ln.requestPermissions).not.toHaveBeenCalled();
    });

    it('refusée dans les réglages : jamais redemandée', async () => {
      ln.permission = 'denied';
      expect((await sync({ prompt: 'always' })).outcome).toBe('no-permission');
      expect(ln.requestPermissions).not.toHaveBeenCalled();
      expect(await getReminderPermission()).toBe('denied');
    });
  });

  it('Android : crée le canal des rappels', async () => {
    mockPlatform.mockReturnValue('android');
    mockFetchAgenda.mockResolvedValue({ items: [item({})] });
    await sync();
    expect(ln.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: REMINDER_CHANNEL_ID, name: 'Rappels de soins', importance: 4 }),
    );
  });

  it('sur le web : aucun effet', async () => {
    mockIsNative.mockReturnValue(false);
    expect(await sync()).toEqual({ outcome: 'unsupported', count: 0, source: null });
    await clearLocalReminders();
    await cancelAllLocalReminders();
    expect(mockFetchAgenda).not.toHaveBeenCalled();
    expect(ln.getPending).not.toHaveBeenCalled();
    expect(await getReminderPermission()).toBe('denied');
    expect(await countScheduledReminders()).toBe(0);
  });

  it('déconnexion : annule les rappels et oublie la liste du compte', async () => {
    mockFetchAgenda.mockResolvedValueOnce({ items: hourly(2) });
    await sync();
    await clearLocalReminders();
    expect(ln.pending).toHaveLength(0);
    mockFetchAgenda.mockRejectedValueOnce(new AgendaApiError('network', 0));
    expect((await sync()).outcome).toBe('unavailable');
  });

  it('sérialise les synchronisations concurrentes', async () => {
    let release: (v: unknown) => void = () => undefined;
    mockFetchAgenda.mockImplementationOnce(() => new Promise((r) => (release = r)));
    mockFetchAgenda.mockResolvedValueOnce({ items: hourly(1) });
    const first = sync();
    const second = sync();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetchAgenda).toHaveBeenCalledTimes(1);
    release({ items: hourly(3) });
    expect((await first).count).toBe(3);
    expect((await second).count).toBe(1);
    expect(ln.pending).toHaveLength(1);
  });
});
