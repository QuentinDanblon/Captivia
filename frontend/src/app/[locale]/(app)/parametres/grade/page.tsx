'use client';

import { useCallback, useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { reminderLabelKey } from '@/lib/reminder-labels';
import {
  Alert,
  Button,
  Card,
  CareTimeline,
  EmptyState,
  Skeleton,
  SkeletonGroup,
  buttonClasses,
  cx,
  type CareStatus,
} from '@/components/ui';
import { SettingsHeader } from '../_components/SettingsHeader';

/** Grades, du premier au dernier (seuils côté API : GradeService). */
const GRADES = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

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

/**
 * Sceau de grade au trait : deux cercles et cinq losanges, pleins jusqu'au rang atteint.
 * Remplace les médailles en dégradé (pas de doré ni de dégradé, DESIGN.md § 8).
 */
function GradeSeal({ level, size = 88, className }: { level: number; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} fill="none" aria-hidden="true" data-level={level}>
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.5 2" />
      {GRADES.map((_, i) => {
        const x = 24 + (i - 2) * 6.4;
        const filled = i < level;
        return (
          <path
            key={i}
            d={`M${x} 20.6 ${x + 2.6} 24 ${x} 27.4 ${x - 2.6} 24Z`}
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

const STATUS_OF: Record<string, CareStatus> = { done: 'done', skipped: 'skipped', pending: 'due' };

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

  const loadData = useCallback(async () => {
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
  }, [token]);

  useEffect(() => {
    if (user && token) {
      void loadData();
    }
  }, [user, token, loadData]);

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

  /** Libellé affiché : clé de type connue (« uvb »…) traduite, sinon le libellé de l'API. */
  const eventTitle = (ev: NotificationEvent): string => {
    const key = reminderLabelKey(ev.label || ev.type);
    return key ? t(key) : ev.label || ev.type;
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
      setGradeError(t(errorKey(e, { fallback: 'grade.deleteError' })));
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('common.loading')} className="grid gap-6">
          <Skeleton width="35%" height={40} />
          <div className="grid gap-6 md:grid-cols-12">
            <Skeleton shape="block" height={340} className="md:col-span-5" />
            <Skeleton shape="block" height={340} className="md:col-span-7" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  const displayGrade = grade ?? DEFAULT_GRADE;
  const gradeName = (key: string) =>
    (GRADES as readonly string[]).includes(key) ? t(`grade.${key}` as Parameters<typeof t>[0]) : key;
  const level = Math.max(0, GRADES.indexOf(displayGrade.grade as (typeof GRADES)[number])) + 1;
  const target = displayGrade.points - displayGrade.pointsInCurrent + displayGrade.pointsNeededForNext;
  const remaining = Math.max(0, target - displayGrade.points);
  const percent = Math.max(0, Math.min(100, displayGrade.progressPercent ?? 0));
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  const statusLabels = {
    done: t('grade.done'),
    due: t('today.status.due'),
    overdue: t('today.status.overdue'),
    planned: t('today.status.planned'),
    skipped: t('grade.skipped'),
  };

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <SettingsHeader
        title={t('grade.title')}
        description={t('grade.lead')}
        marginNote={t('grade.pointsCount', { count: displayGrade.points })}
        marginLabel={t('grade.points')}
      />

      {gradeError ? <Alert severity="warning" title={gradeError} /> : null}

      <div className="grid gap-6 md:grid-cols-12">
        <Card as="section" title={t('grade.yourStatus')} titleId="grade-status" className="self-start md:col-span-5">
          <div className="flex items-center gap-5">
            <GradeSeal level={level} className="shrink-0 text-accent-text" />
            <div className="grid min-w-0 gap-1">
              <p className="m-0 font-display text-h2 text-ink">{gradeName(displayGrade.grade)}</p>
              <p className="m-0 font-mono text-body text-ink-2">
                {t('grade.pointsCount', { count: displayGrade.points })}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-2 border-t border-line pt-5">
            {displayGrade.nextGrade ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-ui">
                  <span className="text-ink">{t('grade.towards', { grade: gradeName(displayGrade.nextGrade) })}</span>
                  <span className="font-mono text-ink-2">
                    {number.format(displayGrade.points)} / {number.format(target)}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-sunken"
                  role="progressbar"
                  aria-valuenow={displayGrade.points}
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-label={t('grade.progressBarLabel')}
                >
                  <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${percent}%` }} />
                </div>
                <p className="m-0 text-meta text-ink-2">
                  {t('grade.remaining', { count: remaining, grade: gradeName(displayGrade.nextGrade) })}
                </p>
              </>
            ) : (
              <p className="m-0 text-ui text-ink">{t('grade.maxGrade')}</p>
            )}
          </div>

          <ol className="m-0 mt-6 grid list-none grid-cols-5 gap-1 border-t border-line p-0 pt-5" aria-label={t('grade.scaleLabel')}>
            {GRADES.map((key, index) => {
              const state = index + 1 < level ? 'done' : index + 1 === level ? 'current' : 'todo';
              return (
                <li
                  key={key}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className="grid gap-2"
                >
                  <span aria-hidden="true" className={cx('h-1 rounded-full', state === 'todo' ? 'bg-line-strong' : 'bg-accent')} />
                  <span className={cx('text-meta', state === 'current' ? 'font-semibold text-ink' : 'text-ink-2')}>
                    {gradeName(key)}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card as="section" title={t('grade.remindersToday')} titleId="reminders-today" className="self-start md:col-span-7">
          <p className="m-0 mb-5 text-ui text-ink-2">{t('grade.remindersIntro')}</p>
          {events.length === 0 ? (
            <EmptyState
              title={t('grade.noRemindersTitle')}
              benefit={t('grade.noReminders')}
              action={
                <Link href="/parametres/notifications" className={buttonClasses({ size: 'sm', variant: 'secondary' })}>
                  {t('grade.setUpReminders')}
                </Link>
              }
            />
          ) : (
            <CareTimeline
              label={t('grade.remindersToday')}
              statusLabels={statusLabels}
              items={events.map((ev) => ({
                id: ev.id,
                date: ev.scheduledAt,
                title: eventTitle(ev),
                status: STATUS_OF[ev.status] ?? 'planned',
                kind:
                  ev.status === 'done' && ev.pointsAwarded
                    ? t('grade.pointsAwarded', { count: ev.pointsAwarded })
                    : ev.routineId
                      ? t('grade.routineWorth')
                      : undefined,
                action: (
                  <div className="flex flex-wrap items-center gap-2">
                    {ev.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="secondary" loading={actionId === ev.id} onClick={() => handleMark(ev.id, 'done')}>
                          {t('grade.markDone')}
                        </Button>
                        <Button size="sm" variant="quiet" disabled={actionId === ev.id} onClick={() => handleMark(ev.id, 'skipped')}>
                          {t('grade.markSkipped')}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="quiet"
                      loading={deletingId === ev.id}
                      onClick={() => handleDeleteReminder(ev.id)}
                      aria-label={`${t('grade.deleteReminder')} — ${eventTitle(ev)}`}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
