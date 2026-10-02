'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, CalendarPlus, Link2Off, Pill, RefreshCw, Stethoscope, Syringe, Repeat } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  AGENDA_TYPES,
  buildFeedUrl,
  distinctAnimals,
  fetchAgenda,
  filterItems,
  getCalendarTokenStatus,
  groupByDay,
  localDayKey,
  rangeFromToday,
  regenerateCalendarToken,
  revokeCalendarToken,
  type AgendaItem,
  type AgendaItemType,
  type AgendaResponse,
} from '@/lib/agenda';

const RANGE_OPTIONS = [
  { days: 7, labelKey: 'range7' },
  { days: 30, labelKey: 'range30' },
  { days: 92, labelKey: 'range90' },
] as const;

const TYPE_ICONS: Record<AgendaItemType, typeof Pill> = {
  routine: Repeat,
  medication: Pill,
  vaccination: Syringe,
  vet_appointment: Stethoscope,
};

const TYPE_BADGE_CLASS: Record<AgendaItemType, string> = {
  routine: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  medication: 'bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  vaccination: 'bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  vet_appointment: 'bg-sky-50 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
};

const FEED_URL_KEY = 'captivia:agenda-feed-url';

function readCachedFeedUrl(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(FEED_URL_KEY);
    const parsed = raw ? (JSON.parse(raw) as { userId?: string; url?: string }) : null;
    return parsed?.userId === userId && typeof parsed.url === 'string' ? parsed.url : null;
  } catch {
    return null;
  }
}

function writeCachedFeedUrl(userId: string, url: string | null) {
  try {
    if (url) localStorage.setItem(FEED_URL_KEY, JSON.stringify({ userId, url }));
    else localStorage.removeItem(FEED_URL_KEY);
  } catch {
    // stockage indisponible : le lien reste affiché pour la session courante
  }
}

/** Date locale à midi à partir de `YYYY-MM-DD` (évite tout décalage de fuseau à l'affichage). */
function dayKeyToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export default function AgendaPage() {
  const t = useTranslations('agenda');
  const locale = useLocale();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [animalId, setAnimalId] = useState('');
  const [type, setType] = useState<AgendaItemType | ''>('');

  const [feedActive, setFeedActive] = useState(false);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedMessage, setFeedMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try {
      const { from, to } = rangeFromToday(days);
      setData(await fetchAgenda(token, from, to));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getCalendarTokenStatus(token)
      .then((s) => {
        if (cancelled) return;
        setFeedActive(s.active);
        setFeedUrl(s.active ? readCachedFeedUrl(user?.id) : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [locale],
  );
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const animals = useMemo(() => distinctAnimals(items), [items]);
  const filtered = useMemo(() => filterItems(items, { animalId, type }), [items, animalId, type]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const todayKey = localDayKey(new Date());
  const filtersActive = animalId !== '' || type !== '';

  const copy = async (url: string, successKey: 'copied' | 'regenerated') => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedMessage({ text: t(`sub.${successKey}`), error: false });
    } catch {
      setFeedMessage({ text: t('sub.copyFailed'), error: false });
    }
  };

  const generate = async (successKey: 'copied' | 'regenerated') => {
    if (!token || !user) return;
    setFeedBusy(true);
    setFeedMessage(null);
    try {
      const res = await regenerateCalendarToken(token);
      const url = buildFeedUrl(res.feedPath);
      writeCachedFeedUrl(user.id, url);
      setFeedUrl(url);
      setFeedActive(true);
      await copy(url, successKey);
    } catch {
      setFeedMessage({ text: t('sub.error'), error: true });
    } finally {
      setFeedBusy(false);
      setConfirmRegenerate(false);
    }
  };

  const handleSubscribe = async () => {
    if (feedActive && feedUrl) {
      setFeedMessage(null);
      await copy(feedUrl, 'copied');
    } else {
      await generate('copied');
    }
  };

  const handleRevoke = async () => {
    if (!token || !user) return;
    setFeedBusy(true);
    setFeedMessage(null);
    try {
      await revokeCalendarToken(token);
      writeCachedFeedUrl(user.id, null);
      setFeedUrl(null);
      setFeedActive(false);
      setConfirmRegenerate(false);
      setFeedMessage({ text: t('sub.revoked'), error: false });
    } catch {
      setFeedMessage({ text: t('sub.error'), error: true });
    } finally {
      setFeedBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300" role="status">
          {t('loading')}
        </p>
      </div>
    );
  }

  const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60';
  const selectClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <header className="mb-6">
          <h1 className="flex items-center gap-3 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
            <CalendarDays className="h-7 w-7 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">{t('subtitle')}</p>
        </header>

        {/* Abonnement calendrier externe */}
        <section
          aria-labelledby="agenda-sub-title"
          className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 id="agenda-sub-title" className="text-lg font-semibold text-gray-800 dark:text-white">
            {t('sub.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('sub.description')}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {feedActive ? t('sub.active') : t('sub.inactive')}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={feedBusy}
              className={`${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800`}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              {t('sub.button')}
            </button>
            {feedActive && !confirmRegenerate && (
              <button
                type="button"
                onClick={() => setConfirmRegenerate(true)}
                disabled={feedBusy}
                className={`${buttonBase} border border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700`}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('sub.regenerate')}
              </button>
            )}
            {feedActive && (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={feedBusy}
                className={`${buttonBase} border border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700`}
              >
                <Link2Off className="h-4 w-4" aria-hidden="true" />
                {t('sub.revoke')}
              </button>
            )}
          </div>

          {confirmRegenerate && (
            <div
              role="alertdialog"
              aria-labelledby="agenda-regenerate-question"
              className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
            >
              <p id="agenda-regenerate-question" className="text-sm font-medium">
                {t('sub.regenerateConfirm')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generate('regenerated')}
                  disabled={feedBusy}
                  className={`${buttonBase} bg-amber-700 text-white hover:bg-amber-800`}
                >
                  {t('sub.confirmYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRegenerate(false)}
                  className={`${buttonBase} border border-amber-700 text-amber-900 dark:text-amber-100`}
                >
                  {t('sub.confirmNo')}
                </button>
              </div>
            </div>
          )}

          {feedActive && feedUrl && (
            <div className="mt-3">
              <label htmlFor="agenda-feed-url" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('sub.urlLabel')}
              </label>
              <input
                id="agenda-feed-url"
                type="text"
                readOnly
                value={feedUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t('sub.secret')}</p>
            </div>
          )}

          <p
            role="status"
            aria-live="polite"
            className={`mt-3 text-sm ${feedMessage?.error ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`}
          >
            {feedMessage?.text}
          </p>
        </section>

        {/* Période et filtres */}
        <div role="group" aria-label={t('filtersLabel')} className="mb-6 grid gap-4 sm:grid-cols-3">
          <div>
            <span id="agenda-range-label" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('rangeLabel')}
            </span>
            <div role="group" aria-labelledby="agenda-range-label" className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  aria-pressed={days === opt.days}
                  onClick={() => setDays(opt.days)}
                  className={`flex-1 px-2 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700 ${
                    days === opt.days
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="agenda-animal" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('animalFilter')}
            </label>
            <select id="agenda-animal" value={animalId} onChange={(e) => setAnimalId(e.target.value)} className={selectClass}>
              <option value="">{t('allAnimals')}</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="agenda-type" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('typeFilter')}
            </label>
            <select
              id="agenda-type"
              value={type}
              onChange={(e) => setType(e.target.value as AgendaItemType | '')}
              className={selectClass}
            >
              <option value="">{t('allTypes')}</option>
              {AGENDA_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`types.${value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contenu */}
        <div aria-busy={loading}>
          {loading && !data && (
            <p role="status" className="py-10 text-center text-gray-600 dark:text-gray-300">
              {t('loading')}
            </p>
          )}

          {failed && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              <p>{t('error')}</p>
              <button
                type="button"
                onClick={() => void load()}
                className={`${buttonBase} mt-3 bg-red-700 text-white hover:bg-red-800`}
              >
                {t('retry')}
              </button>
            </div>
          )}

          {!failed && data && (
            <>
              {data.truncated && (
                <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                  {t('truncated')}
                </p>
              )}

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-600 dark:bg-gray-800">
                  <CalendarDays className="mx-auto h-10 w-10 text-gray-400" aria-hidden="true" />
                  <h2 className="mt-3 text-lg font-semibold text-gray-800 dark:text-white">{t('emptyTitle')}</h2>
                  <p className="mt-1 text-gray-600 dark:text-gray-300">{t('emptyHint')}</p>
                  <Link
                    href="/mes-animaux"
                    className={`${buttonBase} mt-4 bg-emerald-700 text-white hover:bg-emerald-800`}
                  >
                    {t('emptyAction')}
                  </Link>
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center dark:bg-gray-800">
                  <p className="text-gray-700 dark:text-gray-200">{t('noMatch')}</p>
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnimalId('');
                        setType('');
                      }}
                      className={`${buttonBase} mt-3 border border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700`}
                    >
                      {t('resetFilters')}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="sr-only" role="status" aria-live="polite">
                    {t('count', { count: filtered.length })}
                  </p>
                  <div aria-label={t('listLabel')} role="region" className="space-y-6">
                    {groups.map((group) => {
                      const headingId = `agenda-day-${group.day}`;
                      return (
                        <section key={group.day} aria-labelledby={headingId}>
                          <h2
                            id={headingId}
                            className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold capitalize text-gray-800 dark:text-white"
                          >
                            <time dateTime={group.day}>{dayFormat.format(dayKeyToDate(group.day))}</time>
                            {group.day === todayKey && (
                              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold normal-case text-white">
                                {t('today')}
                              </span>
                            )}
                          </h2>
                          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                            {group.items.map((item) => (
                              <AgendaRow
                                key={item.id}
                                item={item}
                                time={item.allDay ? t('allDay') : timeFormat.format(new Date(item.date))}
                                typeLabel={t(`types.${item.type}`)}
                                statusLabel={t(`status.${item.status}`)}
                              />
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AgendaRow({
  item,
  time,
  typeLabel,
  statusLabel,
}: {
  item: AgendaItem;
  time: string;
  typeLabel: string;
  statusLabel: string;
}) {
  const Icon = TYPE_ICONS[item.type];
  const muted = item.status === 'done' || item.status === 'skipped' || item.status === 'cancelled';
  return (
    <li className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <div className="w-32 shrink-0 text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
        <time dateTime={item.allDay ? item.day : item.date}>{time}</time>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`break-words font-medium text-gray-900 dark:text-white ${muted ? 'line-through opacity-70' : ''}`}>
          {item.title}
        </p>
        <p className="break-words text-sm text-gray-600 dark:text-gray-300">
          {item.animalName}
          {item.detail ? ` · ${item.detail}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_BADGE_CLASS[item.type]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {typeLabel}
        </span>
        {item.status !== 'pending' && (
          <span className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200">
            {statusLabel}
          </span>
        )}
      </div>
    </li>
  );
}
