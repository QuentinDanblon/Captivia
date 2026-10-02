'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

const BADGE_IMAGES: Record<string, string> = {
  bronze: '/badges/bronze.svg',
  silver: '/badges/silver.svg',
  gold: '/badges/gold.svg',
  platinum: '/badges/platinum.svg',
  diamond: '/badges/diamond.svg',
};

type GradeData = {
  points: number;
  grade: string;
  nextGrade: string | null;
  pointsInCurrent: number;
  pointsNeededForNext: number;
  progressPercent: number;
};

const DEFAULT_GRADE: GradeData = {
  points: 0,
  grade: 'bronze',
  nextGrade: 'silver',
  pointsInCurrent: 0,
  pointsNeededForNext: 500,
  progressPercent: 0,
};

type NotificationEvent = {
  id: string;
  type: string;
  label: string | null;
  scheduledAt: string;
  status: string;
  pointsAwarded: number;
  routineId?: string;
};

export default function GradePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [grade, setGrade] = useState<GradeData | null>(DEFAULT_GRADE);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) {
      loadData();
    }
  }, [user, token]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Sans `date` : le backend prend « aujourd'hui » dans le fuseau du compte (User.timezone),
      // comme le scheduler de rappels et l'agenda. L'ancienne date UTC du navigateur désignait
      // la veille entre minuit et 2 h à Paris.
      const [gradeRes, eventsRes] = await Promise.all([
        api.getGrade(token),
        api.getNotificationEvents(token, undefined, true),
      ]);
      setGrade(gradeRes?.points != null ? gradeRes : null);
      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMark = async (eventId: string, status: 'done' | 'skipped') => {
    if (!token) return;
    setActionId(eventId);
    try {
      const res = await api.setNotificationEventStatus(eventId, status, token);
      if (res?.grade) setGrade(res.grade);
      if (res?.event) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, ...res.event } : e))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteReminder = async (eventId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!authToken) return;
    setDeletingId(eventId);
    setGradeError(null);
    try {
      const res = await api.deleteNotificationEvent(eventId, authToken);
      if (res?.deleted !== false) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      } else {
        setGradeError(t('grade.deleteError'));
      }
    } catch (e) {
      console.error(e);
      setGradeError(e instanceof Error ? e.message : (t('grade.deleteError')));
    } finally {
      setDeletingId(null);
    }
  };

  const displayGrade = grade ?? DEFAULT_GRADE;
  const gradeLabelKey = displayGrade.grade ? `grade.${displayGrade.grade}` : '';
  const gradeLabel = gradeLabelKey ? t(gradeLabelKey as Parameters<typeof t>[0]) : displayGrade.grade;

  /** Couleur de la barre selon le pourcentage acquis (0→rouge/ambre, 50→jaune, 75→vert clair, 100→vert) */
  const progressBarColor = (pct: number) => {
    if (pct >= 75) return 'from-emerald-500 to-emerald-600 dark:from-emerald-500 dark:to-emerald-400';
    if (pct >= 50) return 'from-lime-500 to-emerald-500 dark:from-lime-400 dark:to-emerald-500';
    if (pct >= 25) return 'from-amber-400 to-lime-500 dark:from-amber-400 dark:to-lime-400';
    return 'from-amber-500 to-amber-400 dark:from-amber-500 dark:to-amber-400';
  };
  const progressPercent = Math.max(0, Math.min(100, displayGrade.progressPercent ?? 0));

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4" />
          <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <nav className="text-sm text-gray-500 mb-4">
          <Link href="/parametres" className="hover:text-emerald-600">
            {t('settings.title')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-white">{t('grade.title')}</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6">
          {t('grade.title')}
        </h1>

        {/* Statut actuel : grade + médaille + points — toujours affiché */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            {t('grade.yourStatus')}
          </h2>
          {gradeError && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">{gradeError}</p>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0 relative w-28 h-28 flex items-center justify-center">
              <img
                src={BADGE_IMAGES[displayGrade.grade] || BADGE_IMAGES.bronze}
                alt=""
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain absolute inset-0 m-auto"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.visibility = 'hidden';
                  const fallback = el.parentElement?.querySelector('.badge-fallback') as HTMLElement;
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              <div
                className="badge-fallback hidden w-24 h-24 sm:w-28 sm:h-28 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-4xl"
                aria-hidden
              >
                🏅
              </div>
            </div>
            <div className="flex-1 w-full min-w-0 text-center sm:text-left">
              <p className="text-2xl font-bold text-gray-800 dark:text-white capitalize flex items-center justify-center sm:justify-start gap-2">
                <img
                  src={BADGE_IMAGES[displayGrade.grade] || BADGE_IMAGES.bronze}
                  alt=""
                  className="w-8 h-8 object-contain shrink-0"
                  aria-hidden
                />
                {gradeLabel}
              </p>
              <p className="text-lg text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                {displayGrade.points} {t('grade.points')}
              </p>
            </div>
          </div>

          {/* Barre d'évolution des points — progression verte visible quand on marque routine/notification comme fait */}
          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-600">
            {displayGrade.nextGrade ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {displayGrade.points} / {displayGrade.points - displayGrade.pointsInCurrent + displayGrade.pointsNeededForNext}{' '}
                  {t('grade.points')} → {t(`grade.${displayGrade.nextGrade}` as Parameters<typeof t>[0])}
                </p>
                <div
                  className="w-full h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                  role="progressbar"
                  aria-valuenow={displayGrade.points}
                  aria-valuemin={0}
                  aria-valuemax={displayGrade.points - displayGrade.pointsInCurrent + displayGrade.pointsNeededForNext}
                  aria-label={t('grade.progressBarLabel')}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out min-w-[12px] bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-500 dark:to-emerald-400 shadow-sm"
                    style={{
                      width: `${Math.max(0, Math.min(100, displayGrade.progressPercent ?? 0))}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                  {Math.round(displayGrade.progressPercent ?? 0)}% {t('grade.progressToNext')}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {displayGrade.points} {t('grade.points')} — {t(`grade.${displayGrade.grade}` as Parameters<typeof t>[0])} max
                </p>
                <div
                  className="w-full h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                  role="progressbar"
                  aria-valuenow={displayGrade.points}
                  aria-valuemin={0}
                  aria-valuemax={displayGrade.points}
                >
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-500 dark:to-emerald-400" />
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                  100% — {t('grade.maxGrade')}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Rappels du jour — créés par routines et préférences notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            {t('grade.remindersToday')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('grade.routinesCreateReminders')}
          </p>
          {events.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t('grade.noReminders')}
            </p>
          ) : (
            <ul className="space-y-3">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white">
                      {ev.label || ev.type}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(ev.scheduledAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {ev.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={actionId === ev.id}
                          onClick={() => handleMark(ev.id, 'done')}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {ev.routineId
                            ? t('grade.markDoneRoutine')
                            : t('grade.markDoneNotification')}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === ev.id}
                          onClick={() => handleMark(ev.id, 'skipped')}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                        >
                          {t('grade.markSkipped')}
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-sm font-medium px-3 py-1 rounded-full ${
                          ev.status === 'done'
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                      {ev.status === 'done'
                        ? (ev.pointsAwarded
                            ? `${t('grade.done')} (+${ev.pointsAwarded} pts)`
                            : t('grade.done'))
                        : t('grade.skipped')}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === ev.id}
                      onClick={() => handleDeleteReminder(ev.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title={t('grade.deleteReminder')}
                      aria-label={t('grade.deleteReminder')}
                    >
                      {deletingId === ev.id ? (
                        <span className="inline-block w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/parametres"
            className="inline-flex items-center text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            ← {t('settings.title')}
          </Link>
        </div>
      </div>
    </div>
  );
}
