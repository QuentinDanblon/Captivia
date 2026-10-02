'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isGuestUser } from '@/lib/guest';
import { Link } from '@/i18n/navigation';

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

import { API_URL } from '@/lib/config';
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
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** État du Web Push de CE navigateur (null = en cours de détection). */
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  /** Nouveau sujet en cours de saisie (personnalisation) */
  const [newTypeLabel, setNewTypeLabel] = useState('');
  /** Édition du libellé : type en cours d’édition => valeur du champ */
  const [editingType, setEditingType] = useState<{ key: string; value: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'my-notifications'>('config');

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
      const response = await fetch(
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
    setPushStatus(await resolvePushStatus(key));
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
      const response = await fetch(
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
      const response = await fetch(
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 min-w-0">
        <nav className="text-sm text-gray-500">
          <Link href="/parametres" className="hover:text-emerald-600">
            {t('settings.title')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-white">{t('notifications.title')}</span>
        </nav>
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">
          {t('notifications.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('notifications.description')}
        </p>

        {/* Tabs: Configurer | Mes notifications */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'config'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 border border-b-0 border-gray-200 dark:border-gray-700 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {t('notifications.tabConfig')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-notifications')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'my-notifications'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 border border-b-0 border-gray-200 dark:border-gray-700 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {t('notifications.tabMyNotifications')}
          </button>
        </div>

        <div className="space-y-6">
          {/* Tab: Mes notifications — liste des notifications enregistrées */}
          {activeTab === 'my-notifications' && preferences && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('notifications.tabMyNotifications')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('notifications.myNotificationsDescription')}
              </p>
              {Object.entries(preferences.types ?? {}).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 py-4">
                  {t('notifications.noNotificationsSaved')}
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(preferences.types ?? {}).map(([type, enabled]) => {
                    const schedule: TypeSchedule =
                      (preferences.typeSchedules ?? {})[type] ?? DEFAULT_TYPE_SCHEDULE;
                    const recurrenceLabel =
                      RECURRENCE_OPTIONS.find((o) => o.value === schedule.recurrence)?.labelKey ||
                      schedule.recurrence;
                    return (
                      <div
                        key={type}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30"
                      >
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">{type}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('notifications.time')} {schedule.time} · {t(recurrenceLabel as Parameters<typeof t>[0])}
                            {schedule.recurrence === 'weekly' && schedule.weekDay != null && (
                              <> · {t(`notifications.weekDay${schedule.weekDay}` as Parameters<typeof t>[0])}</>
                            )}
                            {schedule.recurrence === 'once' && schedule.date && (
                              <> · {schedule.date}</>
                            )}
                          </p>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                              enabled
                                ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {enabled ? t('notifications.enabled') : t('notifications.disabled')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingType({ key: type, value: type });
                              setActiveTab('config');
                            }}
                            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeType(type)}
                            className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Configurer — contenu actuel */}
          {activeTab === 'config' && (
            <>
          {/* Enable Notifications */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {t('notifications.enable')}
            </h2>
            {pushStatus === null && (
              <p className="text-sm text-gray-500 dark:text-gray-400">…</p>
            )}
            {pushStatus === 'unsupported' && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('notifications.pushUnsupported')}
              </p>
            )}
            {pushStatus === 'unavailable' && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('notifications.pushUnavailable')}
              </p>
            )}
            {pushStatus === 'denied' && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('notifications.pushBlocked')}
              </p>
            )}
            {pushStatus === 'unsubscribed' && (
              <div>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                  {t('notifications.enableBrowser')}
                </p>
                <button
                  type="button"
                  onClick={enablePush}
                  disabled={pushBusy}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pushBusy ? t('notifications.enabling') : t('notifications.enableButton')}
                </button>
              </div>
            )}
            {pushStatus === 'subscribed' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-green-600">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{t('notifications.notificationsEnabled')}</span>
                </div>
                <button
                  type="button"
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pushBusy ? t('notifications.disabling') : t('notifications.disableButton')}
                </button>
              </div>
            )}
            {pushError && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {t('notifications.pushError')}
              </p>
            )}
          </div>

          {/* Canal de réception : téléphone (push) ou email — routines et notifications créent les rappels */}
          {preferences && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">
                {t('notifications.deliveryChannel')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('notifications.deliveryDescription')}
              </p>
              <div className="flex flex-wrap gap-3">
                {(['push', 'email', 'both'] as const).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    // Invité : aucune adresse, rappels par notification seulement (explication ci-dessous).
                    disabled={channel !== 'push' && isGuestUser(user)}
                    aria-describedby={channel !== 'push' && isGuestUser(user) ? 'delivery-guest-note' : undefined}
                    onClick={() => {
                      setPreferences((p) => (p ? { ...p, deliveryChannel: channel } : p));
                      if (autoSaveTimeout) {
                        clearTimeout(autoSaveTimeout);
                        setAutoSaveTimeout(null);
                      }
                      handleSavePreferencesBackend({ ...preferences, deliveryChannel: channel });
                    }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      (preferences.deliveryChannel ?? 'push') === channel
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {channel === 'push' && t('notifications.deliveryPush')}
                    {channel === 'email' && t('notifications.deliveryEmail')}
                    {channel === 'both' && t('notifications.deliveryBoth')}
                  </button>
                ))}
              </div>
              {isGuestUser(user) && (
                <p id="delivery-guest-note" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {t('guest.emailChannelNote')}
                </p>
              )}
            </div>
          )}

          {/* Types de notifications : propositions + personnalisation */}
          {preferences && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('notifications.types')}
              </h2>
              {saveMessage && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                  {saveMessage}
                </div>
              )}

              {/* Sujets suggérés */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
                  {t('notifications.suggestedTypes')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_NOTIFICATION_TYPES.filter(
                    (suggested) => (preferences.types ?? {})[suggested] === undefined,
                  ).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => addType(label)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      + {typeLabel(label)}
                    </button>
                  ))}
                  {SUGGESTED_NOTIFICATION_TYPES.every(
                    (s) => (preferences.types ?? {})[s] !== undefined,
                  ) && SUGGESTED_NOTIFICATION_TYPES.length > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('notifications.allSuggestedAdded')}
                    </span>
                  )}
                </div>
              </div>

              {/* Ma personnalisation : sujets ajoutés, avec activation, horaire et modification */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
                  {t('notifications.myTypes')}
                </h3>
                <div className="space-y-4">
                  {Object.entries(preferences.types ?? {}).map(([type, enabled]) => {
                    const schedule: TypeSchedule =
                      (preferences.typeSchedules ?? {})[type] ?? DEFAULT_TYPE_SCHEDULE;
                    return (
                      <div
                        key={type}
                        className="p-4 border rounded-xl border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30 space-y-3"
                      >
                        {/* Ligne nom + actions */}
                        <div className="flex flex-wrap items-center gap-3">
                          {editingType?.key === type ? (
                            <>
                              <input
                                type="text"
                                value={editingType.value}
                                onChange={(e) =>
                                  setEditingType((prev) => prev && { ...prev, value: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditType();
                                  if (e.key === 'Escape') setEditingType(null);
                                }}
                                className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-gray-900"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={saveEditType}
                                className="shrink-0 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                              >
                                {t('common.save')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingType(null)}
                                className="shrink-0 px-3 py-1.5 text-sm border rounded-lg dark:border-gray-500 dark:text-gray-300"
                              >
                                {t('common.cancel')}
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 min-w-0 font-medium text-gray-800 dark:text-gray-200 truncate">
                                {typeLabel(type)}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditType(type)}
                                className="shrink-0 p-1.5 rounded text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                title={t('notifications.renameType')}
                                aria-label={t('notifications.renameType')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled as boolean}
                                aria-label={enabled ? t('notifications.enabled') : t('notifications.disabled')}
                                onClick={() => updateType(type, !(enabled as boolean))}
                                className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                                  enabled
                                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-transparent border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                                }`}
                              >
                                {enabled ? t('notifications.enabled') : t('notifications.disabled')}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeType(type)}
                                className="shrink-0 p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                title={t('notifications.removeType')}
                                aria-label={t('notifications.removeType')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                        {/* Heure et date pour ce type (masqué en mode édition du nom) */}
                        {editingType?.key !== type && (
                          <div className="flex flex-wrap items-center gap-4 pl-1 border-t border-gray-200 dark:border-gray-600 pt-3">
                            <label className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {t('notifications.time')}
                              </span>
                              <input
                                type="time"
                                value={schedule.time}
                                onChange={(e) => updateTypeSchedule(type, { time: e.target.value })}
                                className="px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {t('notifications.recurrence')}
                              </span>
                              <select
                                value={schedule.recurrence}
                                onChange={(e) => {
                                  const rec = e.target.value as RecurrenceKind;
                                  updateTypeSchedule(type, {
                                    recurrence: rec,
                                    date: rec === 'once' ? schedule.date ?? new Date().toISOString().slice(0, 10) : undefined,
                                    weekDay: rec === 'weekly' ? (schedule.weekDay ?? new Date().getDay()) : undefined,
                                    dayOfMonth: rec === 'monthly' ? (schedule.dayOfMonth ?? new Date().getDate()) : undefined,
                                    intervalHours: rec === 'hourly' ? (schedule.intervalHours ?? 2) : undefined,
                                  });
                                }}
                                className="px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:text-white text-sm min-w-[160px]"
                              >
                                {RECURRENCE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {t(opt.labelKey as Parameters<typeof t>[0])}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {schedule.recurrence === 'once' && (
                              <label className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                  {t('notifications.date')}
                                </span>
                                <input
                                  type="date"
                                  value={schedule.date ?? new Date().toISOString().slice(0, 10)}
                                  onChange={(e) => updateTypeSchedule(type, { date: e.target.value })}
                                  className="px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                                />
                              </label>
                            )}
                            {schedule.recurrence === 'weekly' && (
                              <label className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                  {t('notifications.weekDay')}
                                </span>
                                <select
                                  value={schedule.weekDay ?? new Date().getDay()}
                                  onChange={(e) => updateTypeSchedule(type, { weekDay: parseInt(e.target.value, 10) })}
                                  className="px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:text-white text-sm min-w-[140px]"
                                >
                                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                                    <option key={d} value={d}>
                                      {t(`notifications.weekDay${d}` as Parameters<typeof t>[0])}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {schedule.recurrence === 'monthly' && (
                              <label className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                  {t('notifications.dayOfMonth')}
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={schedule.dayOfMonth ?? new Date().getDate()}
                                  onChange={(e) =>
                                    updateTypeSchedule(type, {
                                      dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                    })
                                  }
                                  className="px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:text-white text-sm w-16"
                                />
                              </label>
                            )}
                            {schedule.recurrence === 'hourly' && (
                              <label className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                  {t('notifications.intervalHours')}
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={24}
                                  value={schedule.intervalHours ?? 2}
                                  onChange={(e) =>
                                    updateTypeSchedule(type, {
                                      intervalHours: Math.min(24, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                    })
                                  }
                                  className="px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:text-white text-sm w-16"
                                />
                                <span className="text-sm text-gray-500">{t('notifications.hours')}</span>
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Ajouter un sujet personnalisé */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newTypeLabel}
                    onChange={(e) => setNewTypeLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addType(newTypeLabel);
                    }}
                    placeholder={t('notifications.addCustomPlaceholder')}
                    className="flex-1 min-w-[180px] px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => addType(newTypeLabel)}
                    disabled={!newTypeLabel.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('notifications.addCustom')}
                  </button>
                </div>
                {Object.keys(preferences.types ?? {}).length === 0 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('notifications.myTypesHint')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Snooze */}
          {preferences && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('notifications.snooze')}
              </h2>
              <input
                type="number"
                min="5"
                max="120"
                step="5"
                value={preferences.snooze ?? 15}
                onChange={(e) => {
                  const snooze = parseInt(e.target.value);
                  autoSavePreferences({ ...preferences, snooze });
                }}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t('notifications.snoozeHint')}
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving || !preferences}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
            <Link
              href="/mes-animaux"
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold text-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </Link>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
