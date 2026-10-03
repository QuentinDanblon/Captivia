'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isGuestUser } from '@/lib/guest';
import { api, type Animal } from '@/lib/api';
import { careStatusOf, summarizeAgenda } from '@/lib/today';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { GuestFeatureNote } from '@/components/guest/GuestFeatureNote';
import {
  Alert,
  Badge,
  Button,
  Card,
  CareTimeline,
  EmptyState,
  Field,
  NumberWheel,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  TaskPill,
  buttonClasses,
  cx,
} from '@/components/ui';
import {
  AGENDA_TYPES,
  buildFeedUrl,
  displayDay,
  fetchAgenda,
  filterItems,
  getCalendarTokenStatus,
  groupByDay,
  agendaPeriodRange,
  filterPeriodItems,
  AGENDA_PERIOD_MAX,
  type AgendaPeriodUnit,
  regenerateCalendarToken,
  revokeCalendarToken,
  type AgendaItemType,
  type AgendaResponse,
} from '@/lib/agenda';

const PERIOD_UNITS: AgendaPeriodUnit[] = ['hours', 'days', 'months'];

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

/**
 * Agenda des soins : la frise de toutes les échéances (routines, traitements, vaccins, visites)
 * sur une durée personnalisée, filtrable par animal et par type ; à côté, l'abonnement du
 * calendrier personnel (flux iCalendar, comptes seulement).
 */
export default function AgendaPage() {
  const t = useTranslations('agenda');
  const tAll = useTranslations();
  const locale = useLocale();
  const tGuest = useTranslations('guest');
  const { user, token, isLoading: authLoading } = useAuth();

  const [unit, setUnit] = useState<AgendaPeriodUnit>('days');
  const [values, setValues] = useState({ hours: 24, days: 30, months: 3 });
  const value = values[unit];
  const requestId = useRef(0);
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [animals, setAnimals] = useState<Pick<Animal, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [animalId, setAnimalId] = useState('');
  const [type, setType] = useState<AgendaItemType | ''>('');
  // Une nouvelle période part de l’instant de sélection.
  const [now, setNow] = useState(() => new Date());
  const period = useMemo(() => agendaPeriodRange(unit, value, now), [unit, value, now]);

  const [feedActive, setFeedActive] = useState(false);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedMessage, setFeedMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setFailed(false);
    try {
      const { from, to } = period;
      const [agenda, registeredAnimals] = await Promise.all([
        fetchAgenda(token, from, to),
        api.getMyAnimals(token),
      ]);
      if (currentRequest !== requestId.current) return;
      setData(agenda);
      // Le filtre reste disponible même pour un animal sans soin prévu dans la période.
      setAnimals(registeredAnimals.map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)));
    } catch {
      if (currentRequest === requestId.current) setFailed(true);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [token, period, locale]);

  useEffect(() => {
    const requests = requestId;
    void load();
    return () => { requests.current++; };
  }, [load]);

  useEffect(() => {
    // Invité : pas de flux iCalendar (réservé aux comptes), rien à interroger.
    if (!token || isGuestUser(user)) return;
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
  }, [token, user]);

  const items = useMemo(() => filterPeriodItems(data?.items ?? [], period), [data, period]);
  const filtered = useMemo(() => filterItems(items, { animalId, type }), [items, animalId, type]);
  // Ordre de la frise : par jour d'affichage, journées entières en tête, puis par heure.
  const ordered = useMemo(() => groupByDay(filtered).flatMap((group) => group.items), [filtered]);
  const summary = useMemo(() => summarizeAgenda(filtered, now), [filtered, now]);
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

  // Sans session : « Essayer sans compte » ou connexion (plus de redirection vers /login).
  if (!authLoading && !user) return <GuestEntry />;

  if (authLoading || !user) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('loading')} className="grid gap-6">
          <Skeleton width="40%" height={40} />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton shape="block" height={420} className="lg:col-span-8" />
            <Skeleton shape="block" height={260} className="lg:col-span-4" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  const guest = isGuestUser(user);
  const { from, to } = period;
  const rangeFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(unit === 'hours' ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  });
  const rangeLabel = unit === 'hours'
    ? `${rangeFormat.format(period.start)} → ${rangeFormat.format(period.end)}`
    : `${rangeFormat.format(dayKeyToDate(from))} → ${rangeFormat.format(dayKeyToDate(to))}`;
  const statusLabels = {
    done: tAll('today.status.done'),
    due: tAll('today.status.due'),
    overdue: tAll('today.status.overdue'),
    planned: tAll('today.status.planned'),
    skipped: tAll('today.status.skipped'),
  };
  const subscribeLabel = !feedActive ? t('sub.button') : feedUrl ? t('sub.buttonCopy') : t('sub.buttonNew');

  const timeline = (
    <Card
      as="section"
      title={t(`period.timeline.${unit}`, { count: value })}
      titleId="agenda-timeline-title"
      actions={
        data && !failed && filtered.length > 0 ? (
          <span className="font-mono text-meta text-ink-2">{t('countShort', { count: filtered.length })}</span>
        ) : undefined
      }
    >
      <div aria-busy={loading}>
        {loading && !data ? (
          <SkeletonGroup label={t('loading')} className="grid gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4">
                <Skeleton width="80%" />
                <Skeleton width={`${72 - i * 10}%`} />
              </div>
            ))}
          </SkeletonGroup>
        ) : failed ? (
          <Alert
            severity="urgent"
            title={t('error')}
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t('retry')}
              </Button>
            }
          />
        ) : data ? (
          <div className="grid gap-5">
            {data.truncated ? <Alert severity="warning" title={t('truncated')} /> : null}

            {items.length === 0 ? (
              <EmptyState
                title={t('emptyTitle')}
                benefit={t('emptyHint')}
                action={
                  <Link href="/mes-animaux" className={buttonClasses({ size: 'sm' })}>
                    {t('emptyAction')}
                  </Link>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                title={t('noMatch')}
                benefit={t('noMatchBenefit')}
                action={
                  filtersActive ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAnimalId('');
                        setType('');
                      }}
                    >
                      {t('resetFilters')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <p className="sr-only" role="status" aria-live="polite">
                  {t('count', { count: filtered.length })}
                </p>
                <CareTimeline
                  label={t('listLabel')}
                  allDayLabel={tAll('today.allDayShort')}
                  statusLabels={statusLabels}
                  items={ordered.map((item) => ({
                    id: item.id,
                    date: item.allDay ? `${displayDay(item)}T12:00:00` : item.date,
                    allDay: item.allDay,
                    title: item.title,
                    detail: [animalId === '' ? item.animalName : null, item.detail]
                      .filter(Boolean)
                      .join(' · ') || undefined,
                    status: careStatusOf(item, now),
                    kind: t(`types.${item.type}`),
                  }))}
                />
              </>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <SectionHeader title={t('title')} description={t('subtitle')} marginNote={rangeLabel} marginLabel={t('rangeShown')} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-8">
          {/* Période et filtres */}
          <div role="group" aria-label={t('filtersLabel')} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-3 sm:col-span-2">
              <span id="agenda-range-label" className="text-ui font-medium text-ink">
                {t('rangeLabel')}
              </span>
              <div role="group" aria-labelledby="agenda-range-label"
                className="flex rounded-control border border-line-field bg-surface p-0.5">
                {PERIOD_UNITS.map((option) => (
                  <button key={option} type="button" aria-pressed={unit === option}
                    onClick={() => { setUnit(option); setNow(new Date()); }}
                    className={cx('min-h-11 min-w-0 flex-1 rounded-[4px] px-3 text-ui font-medium transition-colors',
                      unit === option ? 'bg-accent text-on-accent' : 'text-ink hover:bg-sunken')}>
                    {t(`period.units.${option}`)}
                  </button>
                ))}
              </div>
              <NumberWheel key={unit} id="agenda-period-wheel" label={t('period.duration')}
                hint={t('period.hint', { max: AGENDA_PERIOD_MAX[unit] })}
                max={AGENDA_PERIOD_MAX[unit]} value={value}
                valueText={(number) => t(`period.values.${unit}`, { count: number })}
                onChange={(number) => { setValues((previous) => ({ ...previous, [unit]: number })); setNow(new Date()); }} />
              {unit === 'hours' ? <p className="m-0 text-meta text-ink-2">{t('period.hourHint')}</p> : null}
            </div>
            <Field label={t('animalFilter')} id="agenda-animal">
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
                <option value="">{t('allAnimals')}</option>
                {animals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('typeFilter')} id="agenda-type">
              <select value={type} onChange={(e) => setType(e.target.value as AgendaItemType | '')}>
                <option value="">{t('allTypes')}</option>
                {AGENDA_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`types.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {data && !failed && filtered.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <TaskPill count={summary.due} label={tAll('today.pillDue', { count: summary.due })} />
              {summary.overdue > 0 ? (
                <TaskPill count={summary.overdue} tone="danger" label={tAll('today.pillOverdue', { count: summary.overdue })} />
              ) : null}
              {summary.appointments > 0 ? (
                <TaskPill count={summary.appointments} tone="neutral" label={t('pillAppointments', { count: summary.appointments })} />
              ) : null}
            </div>
          ) : null}

          {timeline}
        </div>

        {/* Abonnement calendrier externe — réservé aux comptes : expliqué à l'invité. */}
        <aside className="grid min-w-0 content-start gap-6 lg:col-span-4">
          {guest ? (
            <GuestFeatureNote>{tGuest('calendarNote')}</GuestFeatureNote>
          ) : (
            <Card
              as="section"
              title={t('sub.title')}
              titleId="agenda-sub-title"
              headingLevel={2}
              actions={
                <Badge tone={feedActive ? 'ok' : 'neutral'} dot>
                  {feedActive ? t('sub.activeBadge') : t('sub.inactiveBadge')}
                </Badge>
              }
            >
              <div className="grid gap-5">
                <p className="m-0 text-ui text-ink-2">{t('sub.description')}</p>
                <ol className="m-0 grid list-none gap-0 p-0">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 border-t border-line py-2.5 text-ui">
                      <span className="font-mono text-meta leading-6 text-ink-2">{String(n).padStart(2, '0')}</span>
                      <span className="text-ink">{t(`sub.step${n}`)}</span>
                    </li>
                  ))}
                </ol>

                <Button fullWidth onClick={handleSubscribe} loading={feedBusy}>
                  {subscribeLabel}
                </Button>

                {feedActive && feedUrl ? (
                  <Field label={t('sub.urlLabel')} hint={t('sub.secret')} id="agenda-feed-url">
                    <input
                      type="text"
                      readOnly
                      value={feedUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-meta"
                    />
                  </Field>
                ) : null}

                {confirmRegenerate ? (
                  <div
                    role="alertdialog"
                    aria-labelledby="agenda-regenerate-question"
                    className="grid gap-3 rounded-control bg-warn-soft p-4 text-ink shadow-[inset_3px_0_0_var(--warn)]"
                  >
                    <p id="agenda-regenerate-question" className="m-0 text-ui font-medium">
                      {t('sub.regenerateConfirm')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void generate('regenerated')} disabled={feedBusy}>
                        {t('sub.confirmYes')}
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => setConfirmRegenerate(false)}>
                        {t('sub.confirmNo')}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {feedActive ? (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    {!confirmRegenerate ? (
                      <Button size="sm" variant="quiet" onClick={() => setConfirmRegenerate(true)} disabled={feedBusy}>
                        {t('sub.regenerate')}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="quiet" onClick={handleRevoke} disabled={feedBusy}>
                      {t('sub.revoke')}
                    </Button>
                  </div>
                ) : null}

                <p
                  role="status"
                  aria-live="polite"
                  className={cx('m-0 text-ui empty:hidden', feedMessage?.error ? 'text-danger' : 'text-ok')}
                >
                  {feedMessage?.text}
                </p>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
