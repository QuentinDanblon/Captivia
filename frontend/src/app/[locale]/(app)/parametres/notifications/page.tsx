'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isGuestUser } from '@/lib/guest';
import { Alert, Badge, Button, Card, EmptyState, Field, Skeleton, SkeletonGroup, cx } from '@/components/ui';
import { SettingsHeader } from '../_components/SettingsHeader';
import { NativeRemindersCard } from '@/components/native/NativeRemindersCard';
import { useIsNative } from '@/lib/platform';

/** Fréquences de répétition */
export type RecurrenceKind =
  | 'daily'
  | 'every_2_days'
  | 'every_3_days'
  | 'weekly'
  | 'monthly'
  | 'once'
  | 'hourly';

/** Configuration horaire par type de notification */
export type TypeSchedule = {
  time: string; // HH:mm
  recurrence: RecurrenceKind;
  date?: string; // YYYY-MM-DD si recurrence === 'once'
  weekDay?: number; // 0=dimanche .. 6=samedi si recurrence === 'weekly'
  dayOfMonth?: number; // 1-31 si recurrence === 'monthly'
  intervalHours?: number; // 1-24 si recurrence === 'hourly'
};

/** Forme brute (non fiable) d'un horaire renvoyé par l'API */
interface RawTypeSchedule {
  time?: unknown;
  recurrence?: unknown;
  date?: unknown;
  weekDay?: unknown;
  dayOfMonth?: unknown;
  intervalHours?: unknown;
}

/** Forme brute (non fiable) des préférences renvoyées par l'API */
interface RawPreferences {
  types?: Record<string, unknown>;
  typeSchedules?: Record<string, unknown>;
  schedule?: unknown;
  snooze?: unknown;
  deliveryChannel?: unknown;
  [key: string]: unknown;
}

/** Préférences de notification telles que gérées par la page */
interface NotificationPreferences {
  types?: Record<string, boolean>;
  typeSchedules?: Record<string, TypeSchedule>;
  schedule?: { start: string; end: string };
  snooze?: number;
  deliveryChannel?: string;
  [key: string]: unknown;
}

const DEFAULT_TYPE_SCHEDULE: TypeSchedule = {
  time: '08:00',
  recurrence: 'daily',
};

const RECURRENCE_OPTIONS: { value: RecurrenceKind; labelKey: string }[] = [
  { value: 'hourly', labelKey: 'notifications.recurrenceHourly' },
  { value: 'daily', labelKey: 'notifications.recurrenceDaily' },
  { value: 'every_2_days', labelKey: 'notifications.recurrenceEvery2Days' },
  { value: 'every_3_days', labelKey: 'notifications.recurrenceEvery3Days' },
  { value: 'weekly', labelKey: 'notifications.recurrenceWeekly' },
  { value: 'monthly', labelKey: 'notifications.recurrenceMonthly' },
  { value: 'once', labelKey: 'notifications.recurrenceOnce' },
];

/**
 * Sujets suggérés pour guider l'utilisateur (il peut aussi créer les siens).
 * Les clés ci-dessous sont les identifiants stockés côté API (inchangés) ;
 * seul l'affichage est traduit via notifications.suggested.<id>.
 */
const SUGGESTED_TYPE_LABEL_IDS: Record<string, string> = {
  'Nourrissage': 'feeding',
  'Nettoyage': 'cleaning',
  'UVB / éclairage': 'uvb',
  'Santé': 'health',
  'Rappel vétérinaire': 'vet',
  'Mue': 'shedding',
  'Pondération': 'weighing',
  'Bain': 'bath',
  'Température': 'temperature',
  'Humidité': 'humidity',
};
const SUGGESTED_NOTIFICATION_TYPES = Object.keys(SUGGESTED_TYPE_LABEL_IDS);

import { authFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { localDayKey } from '@/lib/dates';
import {
  fetchVapidPublicKey,
  resolvePushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '@/lib/web-push';

const getApiBase = () => API_URL;

export default function NotificationsPreferencesPage() {
  const t = useTranslations();
  const typeLabel = (type: string): string => {
    const id = SUGGESTED_TYPE_LABEL_IDS[type];
    return id ? t(`notifications.suggested.${id}`) : type;
  };
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** État du Web Push de CE navigateur (null = en cours de détection). */
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(false);
  /** App native : rappels locaux au lieu du Web Push (lu après l'hydratation). */
  const native = useIsNative();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  /** Nouveau sujet en cours de saisie (personnalisation) */
  const [newTypeLabel, setNewTypeLabel] = useState('');
  /** Édition du libellé : type en cours d’édition => valeur du champ */
  const [editingType, setEditingType] = useState<{ key: string; value: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) {
      fetchPreferences();
      checkSubscription();
    }
    // Chargement initial par session : les deux fonctions sont recréées à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const defaultSchedule = { start: '08:00', end: '22:00' };

  /** Anciennes clés API → libellés affichés (évite doublons avec les suggestions) */
  const LEGACY_TYPE_KEYS: Record<string, string> = {
    nourrissage: 'Nourrissage',
    nettoyage: 'Nettoyage',
    uvb: 'UVB / éclairage',
    sante: 'Santé',
  };

  const normalizePreferences = (raw: unknown): NotificationPreferences | null => {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as RawPreferences;
    const types = data.types && typeof data.types === 'object' ? data.types : {};
    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(types)) {
      const label = LEGACY_TYPE_KEYS[key] ?? key;
      normalized[label] = value as boolean;
    }
    const typeSchedules =
      data.typeSchedules && typeof data.typeSchedules === 'object' ? data.typeSchedules : {};
    const normalizedSchedules: Record<string, TypeSchedule> = {};
    const validRecurrence = (r: string): RecurrenceKind => {
      const allowed: RecurrenceKind[] = ['daily', 'every_2_days', 'every_3_days', 'weekly', 'monthly', 'once', 'hourly'];
      return allowed.includes(r as RecurrenceKind) ? (r as RecurrenceKind) : 'daily';
    };
    for (const [key, val] of Object.entries(typeSchedules)) {
      const v = val as RawTypeSchedule | null;
      if (v && typeof v === 'object' && typeof v.time === 'string') {
        const rec = validRecurrence(String(v.recurrence));
        normalizedSchedules[key] = {
          time: v.time || '08:00',
          recurrence: rec,
          date: rec === 'once' && v.date ? String(v.date) : undefined,
          weekDay: rec === 'weekly' && typeof v.weekDay === 'number' ? v.weekDay : undefined,
          dayOfMonth: rec === 'monthly' && typeof v.dayOfMonth === 'number' ? v.dayOfMonth : undefined,
          intervalHours: rec === 'hourly' && typeof v.intervalHours === 'number' ? Math.max(1, Math.min(24, v.intervalHours)) : undefined,
        };
      }
    }
    for (const typeKey of Object.keys(normalized)) {
      if (normalizedSchedules[typeKey] === undefined) {
        normalizedSchedules[typeKey] = { ...DEFAULT_TYPE_SCHEDULE };
      }
    }
    const deliveryChannel =
      typeof data.deliveryChannel === 'string' && ['push', 'email', 'both'].includes(data.deliveryChannel)
        ? data.deliveryChannel
        : 'push';
    return {
      ...data,
      types: normalized,
      typeSchedules: normalizedSchedules,
      schedule: data.schedule && typeof data.schedule === 'object' ? (data.schedule as { start: string; end: string }) : defaultSchedule,
      snooze: typeof data.snooze === 'number' ? data.snooze : 15,
      deliveryChannel,
    };
  };

  const fetchPreferences = async () => {
    const authToken = (token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null))?.trim();
    if (!authToken) return;

    try {
      const response = await authFetch(
        `${getApiBase()}/users/me/notification-preferences`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      if (response.status === 401) {
        setSaveMessage(t('common.sessionExpired'));
        return;
      }
      const data = await response.json();
      setPreferences(normalizePreferences(data));
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscription = async () => {
    const key = await fetchVapidPublicKey();
    setPushKey(key);
    setPushStatus(await resolvePushStatus(key, authTokenOrNull()));
  };

  const authTokenOrNull = () =>
    (token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null))?.trim() || null;

  /** Appelé directement par le clic : la permission du navigateur n'est demandée qu'ici. */
  const enablePush = async () => {
    const authToken = authTokenOrNull();
    if (!authToken) {
      setSaveMessage(t('common.sessionExpired'));
      return;
    }
    setPushBusy(true);
    setPushError(false);
    const result = await subscribeToPush(authToken, pushKey);
    setPushBusy(false);
    switch (result.status) {
      case 'subscribed':
        setPushStatus('subscribed');
        break;
      case 'denied':
        setPushStatus('denied');
        break;
      case 'unavailable':
      case 'unsupported':
        setPushStatus(result.status);
        break;
      case 'dismissed':
        break; // fenêtre de permission fermée sans choix : on reste sur le bouton
      default:
        setPushError(true);
    }
  };

  const disablePush = async () => {
    const authToken = authTokenOrNull();
    if (!authToken) {
      setSaveMessage(t('common.sessionExpired'));
      return;
    }
    setPushBusy(true);
    setPushError(false);
    const ok = await unsubscribeFromPush(authToken);
    setPushBusy(false);
    if (ok) setPushStatus('unsubscribed');
    else setPushError(true);
  };

  const handleSave = async () => {
    const authToken = (token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null))?.trim();
    if (!authToken || !preferences) {
      if (!authToken) setSaveMessage(t('common.sessionExpired'));
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    const payload = {
      types: preferences.types ?? {},
      typeSchedules: preferences.typeSchedules ?? {},
      schedule: preferences.schedule ?? { start: '08:00', end: '22:00' },
      snooze: typeof preferences.snooze === 'number' ? preferences.snooze : 15,
    };

    try {
      const response = await authFetch(
        `${getApiBase()}/users/me/notification-preferences`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setSaveMessage(`${t('notifications.saved')} ✓`);
        setTimeout(() => setSaveMessage(null), 3000);
      } else if (response.status === 401) {
        setSaveMessage(t('common.sessionExpired'));
      } else {
        setSaveMessage((data as { message?: string }).message || t('notifications.saveError'));
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveMessage(t('notifications.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const autoSavePreferences = (newPreferences: NotificationPreferences) => {
    setPreferences(newPreferences);
    
    // Clear previous timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    // Debounce save after 1 second of inactivity
    const timeout = setTimeout(() => {
      handleSavePreferencesBackend(newPreferences);
    }, 1000);
    
    setAutoSaveTimeout(timeout);
  };

  const handleSavePreferencesBackend = async (prefsToSave: NotificationPreferences) => {
    const authToken = (token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null))?.trim();
    if (!authToken) return;

    const payload = {
      types: prefsToSave?.types ?? {},
      typeSchedules: prefsToSave?.typeSchedules ?? {},
      schedule: prefsToSave?.schedule ?? { start: '08:00', end: '22:00' },
      snooze: typeof prefsToSave?.snooze === 'number' ? prefsToSave.snooze : 15,
      deliveryChannel: prefsToSave?.deliveryChannel ?? 'push',
    };

    try {
      const response = await authFetch(
        `${getApiBase()}/users/me/notification-preferences`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSaveMessage(`${t('notifications.saved')} ✓`);
        setTimeout(() => setSaveMessage(null), 3000);
      } else if (response.status === 401) {
        setSaveMessage(t('common.sessionExpired'));
      } else {
        setSaveMessage((data as { message?: string }).message || t('notifications.saveError'));
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveMessage(t('notifications.saveError'));
    }
  };

  const updateType = (type: string, enabled: boolean) => {
    if (!preferences) return;
    const newPreferences = {
      ...preferences,
      types: {
        ...(preferences.types ?? {}),
        [type]: enabled,
      },
    };
    setPreferences(newPreferences);
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      setAutoSaveTimeout(null);
    }
    handleSavePreferencesBackend(newPreferences);
  };

  const addType = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || (preferences?.types ?? {})[trimmed] !== undefined) return;
    const schedules = { ...(preferences?.typeSchedules ?? {}) };
    schedules[trimmed] = { ...DEFAULT_TYPE_SCHEDULE };
    const newPreferences = {
      ...preferences,
      types: { ...(preferences?.types ?? {}), [trimmed]: true },
      typeSchedules: schedules,
    };
    autoSavePreferences(newPreferences);
    setNewTypeLabel('');
  };

  const removeType = (type: string) => {
    const types = { ...(preferences?.types ?? {}) };
    const typeSchedules = { ...(preferences?.typeSchedules ?? {}) };
    delete types[type];
    delete typeSchedules[type];
    autoSavePreferences({ ...preferences, types, typeSchedules });
    if (editingType?.key === type) setEditingType(null);
  };

  const updateTypeSchedule = (
    type: string,
    patch: Partial<TypeSchedule> | ((prev: TypeSchedule) => TypeSchedule),
  ) => {
    const current = (preferences?.typeSchedules ?? {})[type] ?? DEFAULT_TYPE_SCHEDULE;
    const next =
      typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    const typeSchedules = {
      ...(preferences?.typeSchedules ?? {}),
      [type]: next,
    };
    autoSavePreferences({ ...preferences, typeSchedules });
  };

  const startEditType = (key: string) => {
    setEditingType({ key, value: key });
  };

  const saveEditType = () => {
    if (!editingType) return;
    const newKey = editingType.value.trim();
    const types = preferences?.types ?? {};
    const typeSchedules = { ...(preferences?.typeSchedules ?? {}) };
    if (!newKey || newKey === editingType.key) {
      setEditingType(null);
      return;
    }
    if (types[newKey] !== undefined && newKey !== editingType.key) {
      setEditingType(null);
      return;
    }
    const newTypes = { ...types };
    newTypes[newKey] = newTypes[editingType.key];
    delete newTypes[editingType.key];
    if (typeSchedules[editingType.key]) {
      typeSchedules[newKey] = typeSchedules[editingType.key];
      delete typeSchedules[editingType.key];
    }
    autoSavePreferences({ ...preferences, types: newTypes, typeSchedules });
    setEditingType(null);
  };

  if (authLoading || loading) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('common.loading')} className="grid gap-6">
          <Skeleton width="40%" height={40} />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton shape="block" height={460} className="lg:col-span-8" />
            <Skeleton shape="block" height={300} className="lg:col-span-4" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  const guest = isGuestUser(user);
  const typeEntries = Object.entries(preferences?.types ?? {});
  const suggestions = SUGGESTED_NOTIFICATION_TYPES.filter((suggested) => (preferences?.types ?? {})[suggested] === undefined);
  const scheduleSummary = (schedule: TypeSchedule) => {
    const recurrence = RECURRENCE_OPTIONS.find((o) => o.value === schedule.recurrence)?.labelKey;
    const parts: string[] = [];
    parts.push(schedule.time);
    if (schedule.recurrence === 'hourly') parts.push(t('notifications.everyHours', { count: schedule.intervalHours ?? 2 }));
    else if (recurrence) parts.push(t(recurrence as Parameters<typeof t>[0]));
    if (schedule.recurrence === 'weekly' && schedule.weekDay != null) {
      parts.push(t(`notifications.weekDay${schedule.weekDay}` as Parameters<typeof t>[0]));
    }
    if (schedule.recurrence === 'monthly' && schedule.dayOfMonth != null) {
      parts.push(t('notifications.onDay', { day: schedule.dayOfMonth }));
    }
    if (schedule.recurrence === 'once' && schedule.date) parts.push(schedule.date);
    return parts.join(' · ');
  };
  const pushBadge =
    pushStatus === 'subscribed' ? (
      <Badge tone="ok" dot>
        {t('notifications.pushOn')}
      </Badge>
    ) : pushStatus === 'denied' ? (
      <Badge tone="warn" dot>
        {t('notifications.pushOff')}
      </Badge>
    ) : pushStatus === null ? null : (
      <Badge>{t('notifications.pushOff')}</Badge>
    );

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <SettingsHeader title={t('notifications.pageTitle')} description={t('notifications.pageLead')} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-8">
          {/* Rappels : sujets suggérés + personnalisation (activation, horaire, répétition) */}
          {preferences ? (
            <Card as="section" title={t('notifications.remindersTitle')} titleId="reminders-title">
              <p className="m-0 mb-5 text-ui text-ink-2">{t('notifications.remindersIntro')}</p>

              {typeEntries.length === 0 ? (
                <EmptyState title={t('notifications.emptyTitle')} benefit={t('notifications.myTypesHint')} />
              ) : (
                <ul className="m-0 grid list-none border-t border-line p-0">
                  {typeEntries.map(([type, enabled], index) => {
                    const schedule: TypeSchedule = (preferences.typeSchedules ?? {})[type] ?? DEFAULT_TYPE_SCHEDULE;
                    const idBase = `reminder-${index}`;
                    const editing = editingType?.key === type;
                    return (
                      <li key={type} className="grid gap-4 border-b border-line py-5">
                        {/* Nom, état, actions */}
                        {editing ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <Field label={t('notifications.renameType')} id={`${idBase}-name`} className="min-w-[12rem] flex-1">
                              <input
                                type="text"
                                value={editingType.value}
                                onChange={(e) => setEditingType((prev) => prev && { ...prev, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditType();
                                  if (e.key === 'Escape') setEditingType(null);
                                }}
                                autoFocus
                              />
                            </Field>
                            <Button size="sm" onClick={saveEditType}>
                              {t('common.save')}
                            </Button>
                            <Button size="sm" variant="quiet" onClick={() => setEditingType(null)}>
                              {t('common.cancel')}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="grid min-w-0 flex-1 gap-0.5">
                              <p className={cx('m-0 truncate font-medium', enabled ? 'text-ink' : 'text-ink-2')}>{typeLabel(type)}</p>
                              <p className="m-0 font-mono text-meta text-ink-2">{scheduleSummary(schedule)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={typeLabel(type)}
                                onClick={() => updateType(type, !enabled)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-ui text-ink-2 transition-colors hover:bg-sunken"
                              >
                                <span
                                  aria-hidden="true"
                                  className={cx(
                                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors',
                                    enabled ? 'border-accent bg-accent' : 'border-line-field bg-surface',
                                  )}
                                >
                                  <span
                                    className={cx(
                                      'absolute top-0.5 size-3.5 rounded-full transition-[left] duration-150',
                                      enabled ? 'left-[1.1rem] bg-on-accent' : 'left-0.5 bg-line-field',
                                    )}
                                  />
                                </span>
                                <span className="w-[5.5rem] text-left">{enabled ? t('notifications.enabled') : t('notifications.disabled')}</span>
                              </button>
                              <Button size="sm" variant="quiet" onClick={() => startEditType(type)} aria-label={`${t('notifications.renameType')} — ${typeLabel(type)}`}>
                                {t('common.edit')}
                              </Button>
                              <Button size="sm" variant="quiet" onClick={() => removeType(type)} aria-label={`${t('notifications.removeType')} — ${typeLabel(type)}`}>
                                {t('common.delete')}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Heure, répétition et précision (masqués pendant le renommage) */}
                        {!editing ? (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label={t('notifications.time')} id={`${idBase}-time`}>
                              <input
                                type="time"
                                value={schedule.time}
                                onChange={(e) => updateTypeSchedule(type, { time: e.target.value })}
                                className="font-mono"
                              />
                            </Field>
                            <Field label={t('notifications.recurrence')} id={`${idBase}-recurrence`}>
                              <select
                                value={schedule.recurrence}
                                onChange={(e) => {
                                  const rec = e.target.value as RecurrenceKind;
                                  updateTypeSchedule(type, {
                                    recurrence: rec,
                                    date: rec === 'once' ? schedule.date ?? localDayKey(new Date()) : undefined,
                                    weekDay: rec === 'weekly' ? (schedule.weekDay ?? new Date().getDay()) : undefined,
                                    dayOfMonth: rec === 'monthly' ? (schedule.dayOfMonth ?? new Date().getDate()) : undefined,
                                    intervalHours: rec === 'hourly' ? (schedule.intervalHours ?? 2) : undefined,
                                  });
                                }}
                              >
                                {RECURRENCE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {t(opt.labelKey as Parameters<typeof t>[0])}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            {schedule.recurrence === 'once' ? (
                              <Field label={t('notifications.date')} id={`${idBase}-date`}>
                                <input
                                  type="date"
                                  value={schedule.date ?? localDayKey(new Date())}
                                  onChange={(e) => updateTypeSchedule(type, { date: e.target.value })}
                                  className="font-mono"
                                />
                              </Field>
                            ) : null}
                            {schedule.recurrence === 'weekly' ? (
                              <Field label={t('notifications.weekDay')} id={`${idBase}-weekday`}>
                                <select
                                  value={schedule.weekDay ?? new Date().getDay()}
                                  onChange={(e) => updateTypeSchedule(type, { weekDay: parseInt(e.target.value, 10) })}
                                >
                                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                                    <option key={d} value={d}>
                                      {t(`notifications.weekDay${d}` as Parameters<typeof t>[0])}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                            ) : null}
                            {schedule.recurrence === 'monthly' ? (
                              <Field label={t('notifications.dayOfMonth')} id={`${idBase}-day`}>
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  inputMode="numeric"
                                  value={schedule.dayOfMonth ?? new Date().getDate()}
                                  onChange={(e) =>
                                    updateTypeSchedule(type, {
                                      dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                    })
                                  }
                                  className="font-mono"
                                />
                              </Field>
                            ) : null}
                            {schedule.recurrence === 'hourly' ? (
                              <Field label={t('notifications.intervalLabel')} hint={t('notifications.intervalHint')} id={`${idBase}-interval`}>
                                <input
                                  type="number"
                                  min={1}
                                  max={24}
                                  inputMode="numeric"
                                  value={schedule.intervalHours ?? 2}
                                  onChange={(e) =>
                                    updateTypeSchedule(type, {
                                      intervalHours: Math.min(24, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                    })
                                  }
                                  className="font-mono"
                                />
                              </Field>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Idées de rappels */}
              <div className="mt-6 grid gap-3">
                <h3 className="m-0 text-ui font-semibold text-ink">{t('notifications.suggestedTypes')}</h3>
                {suggestions.length > 0 ? (
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {suggestions.map((label) => (
                      <li key={label}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => addType(label)}
                          iconStart={
                            <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          }
                        >
                          {typeLabel(label)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-ui text-ink-2">{t('notifications.allSuggestedAdded')}</p>
                )}
              </div>

              {/* Sujet personnalisé */}
              <div className="mt-6 flex flex-wrap items-end gap-2 border-t border-line pt-5">
                <Field label={t('notifications.addCustomLabel')} id="reminder-new" className="min-w-[12rem] flex-1">
                  <input
                    type="text"
                    value={newTypeLabel}
                    onChange={(e) => setNewTypeLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addType(newTypeLabel);
                    }}
                    placeholder={t('notifications.addCustomPlaceholder')}
                  />
                </Field>
                <Button variant="secondary" onClick={() => addType(newTypeLabel)} disabled={!newTypeLabel.trim()}>
                  {t('notifications.addCustom')}
                </Button>
              </div>
            </Card>
          ) : (
            <Alert severity="warning" title={t('notifications.loadError')} />
          )}

          {/* Report */}
          {preferences ? (
            <Card as="section" title={t('notifications.snoozeTitle')} titleId="snooze-title">
              <Field label={t('notifications.snooze')} hint={t('notifications.snoozeHint')} id="snooze-minutes" className="max-w-xs">
                <input
                  type="number"
                  min="5"
                  max="120"
                  step="5"
                  inputMode="numeric"
                  value={preferences.snooze ?? 15}
                  onChange={(e) => {
                    const snooze = parseInt(e.target.value);
                    autoSavePreferences({ ...preferences, snooze });
                  }}
                  className="font-mono"
                />
              </Field>
            </Card>
          ) : null}
        </div>

        <aside className="grid min-w-0 content-start gap-6 lg:col-span-4">
          {/* App native : rappels programmés sur le téléphone (W6-06) ; navigateur : Web Push sur CET appareil. */}
          {native ? (
            <NativeRemindersCard />
          ) : (
            <Card as="section" title={t('notifications.deviceTitle')} titleId="device-title" actions={pushBadge}>
              <div className="grid gap-4">
                {pushStatus === null ? (
                  <SkeletonGroup label={t('common.loading')}>
                    <Skeleton width="80%" />
                  </SkeletonGroup>
                ) : null}
                {pushStatus === 'unsupported' ? <p className="m-0 text-ui text-ink-2">{t('notifications.pushUnsupported')}</p> : null}
                {pushStatus === 'unavailable' ? <p className="m-0 text-ui text-ink-2">{t('notifications.pushUnavailable')}</p> : null}
                {pushStatus === 'denied' ? <Alert severity="warning" title={t('notifications.pushBlocked')} /> : null}
                {pushStatus === 'unsubscribed' ? (
                  <>
                    <p className="m-0 text-ui text-ink-2">{t('notifications.enableBrowser')}</p>
                    <Button onClick={enablePush} loading={pushBusy} fullWidth>
                      {pushBusy ? t('notifications.enabling') : t('notifications.enableButton')}
                    </Button>
                  </>
                ) : null}
                {pushStatus === 'subscribed' ? (
                  <>
                    <p className="m-0 text-ui text-ink-2">{t('notifications.pushOnText')}</p>
                    <Button variant="secondary" onClick={disablePush} loading={pushBusy} fullWidth>
                      {pushBusy ? t('notifications.disabling') : t('notifications.disableButton')}
                    </Button>
                  </>
                ) : null}
                {pushError ? (
                  <p role="alert" className="m-0 text-ui font-medium text-danger">
                    {t('notifications.pushError')}
                  </p>
                ) : null}
              </div>
            </Card>
          )}

          {/* Canal de réception : téléphone (push) ou e-mail */}
          {preferences ? (
            <Card as="section" title={t('notifications.deliveryTitle')} titleId="delivery-title">
              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-3 p-0 text-ui text-ink-2">{t('notifications.deliveryDescription')}</legend>
                {(['push', 'email', 'both'] as const).map((channel) => {
                  // Invité : aucune adresse, rappels par notification seulement (explication ci-dessous).
                  const locked = channel !== 'push' && guest;
                  const checked = (preferences.deliveryChannel ?? 'push') === channel;
                  return (
                    <label
                      key={channel}
                      className={cx(
                        'flex items-start gap-3 rounded-control border px-3 py-3 text-ui transition-colors',
                        checked ? 'border-accent bg-accent-soft' : 'border-line-field bg-surface',
                        locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-sunken',
                        checked && !locked && 'hover:bg-accent-soft',
                      )}
                    >
                      <input
                        type="radio"
                        name="delivery-channel"
                        value={channel}
                        checked={checked}
                        disabled={locked}
                        aria-describedby={locked ? 'delivery-guest-note' : undefined}
                        onChange={() => {
                          setPreferences((p) => (p ? { ...p, deliveryChannel: channel } : p));
                          if (autoSaveTimeout) {
                            clearTimeout(autoSaveTimeout);
                            setAutoSaveTimeout(null);
                          }
                          handleSavePreferencesBackend({ ...preferences, deliveryChannel: channel });
                        }}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span className="font-medium text-ink">
                        {channel === 'push' && t('notifications.deliveryPush')}
                        {channel === 'email' && t('notifications.deliveryEmail')}
                        {channel === 'both' && t('notifications.deliveryBoth')}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              {guest ? (
                <p id="delivery-guest-note" className="m-0 mt-3 text-ui text-ink-2">
                  {t('guest.emailChannelNote')}
                </p>
              ) : null}
            </Card>
          ) : null}
        </aside>
      </div>

      {/* Enregistrement : automatique à chaque changement ; le bouton force l'envoi. */}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line pt-5">
        <p role="status" aria-live="polite" className="m-0 mr-auto text-ui text-ink-2">
          {saveMessage ?? t('notifications.autoSaveHint')}
        </p>
        <Button onClick={handleSave} loading={saving} disabled={!preferences}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
      </div>
    </div>
  );
}
