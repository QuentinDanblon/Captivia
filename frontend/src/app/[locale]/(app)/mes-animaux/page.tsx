'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isGuestUser } from '@/lib/guest';
import { animalDetailPath } from '@/lib/platform';
import { displayDay } from '@/lib/agenda';
import {
  ageOf,
  animalAlerts,
  careStatusOf,
  commonName,
  daysFrom,
  formatAge,
  formatRelativeDays,
  formatWeight,
  lastWeighing,
  latinName,
  sortAlerts,
  speciesTip,
  summarizeAgenda,
  timelineItems,
  type AnimalAlert,
} from '@/lib/today';
import {
  Alert,
  AnimalCard,
  Button,
  Card,
  CareTimeline,
  EmptyState,
  Modal,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  TaskPill,
  Tip,
  Toast,
  buttonClasses,
  silhouetteKindOf,
} from '@/components/ui';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { GuestSaveBanner } from '@/components/guest/GuestSaveBanner';
import { AddAnimalLockedSlot } from '@/components/guest/AddAnimalLockedSlot';
import AddAnimalFlow from './_components/AddAnimalFlow';
import { useTodayData } from './_components/useTodayData';
import { CommonsPhoto } from '@/components/CommonsPhoto';

/** Alertes affichées en tête ; les suivantes restent dans les fiches. */
const MAX_ALERTS = 4;

function TodaySkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label} className="grid gap-6">
      <Skeleton width="40%" height={40} />
      <div className="flex gap-2">
        <Skeleton width={150} height={26} />
        <Skeleton width={110} height={26} />
      </div>
      <div className="grid gap-6 md:grid-cols-12">
        <Skeleton shape="block" height={320} className="md:col-span-7" />
        <Skeleton shape="block" height={320} className="md:col-span-5" />
      </div>
    </SkeletonGroup>
  );
}

/**
 * « Aujourd'hui » — page d'entrée de l'app (onglet « Mes animaux ») : la journée de chaque animal.
 * Soins du jour et de la semaine (API agenda), alertes graduées (vaccins, traitements, pesées),
 * dernière pesée, conseil tiré de la fiche espèce. Sans animal : le parcours du premier animal.
 */
function TodayPageContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, token, isLoading: authLoading } = useAuth();
  const data = useTodayData(user ? token : null, locale);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [preselected, setPreselected] = useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Horloge figée au montage : statuts et échéances cohérents pendant la visite.
  const [now] = useState(() => new Date());

  const guest = isGuestUser(user);
  const { animals } = data;
  const canAddAnimal = (!guest && user?.isPremium) || animals.length < 1;

  // Arrivée depuis une fiche espèce (« Ajouter à mes animaux ») : espèce présélectionnée, puis
  // URL nettoyée pour qu'un rechargement ne rouvre pas le parcours.
  useEffect(() => {
    if (authLoading || !user || data.status !== 'ready') return;
    const addSpecies = searchParams.get('addSpecies');
    const speciesName = searchParams.get('speciesName');
    if (!addSpecies || !speciesName) return;
    const id = parseInt(addSpecies, 10);
    if (Number.isNaN(id)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ouverture pilotée par l'URL
    setPreselected({ id, name: speciesName });
    if (animals.length > 0) setAddOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, user, authLoading, data.status, animals.length, pathname, router]);

  const onCreated = useCallback(
    (name: string) => {
      setToast(`${name} ${t('animals.animalAdded')}`);
      data.reload();
    },
    [data, t],
  );
  const onRoutinesAdded = useCallback(
    (count: number) => {
      setToast(t('today.routinesAdded', { count }));
      data.reloadAgenda();
    },
    [data, t],
  );
  const closeToast = useCallback(() => setToast(null), []);
  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setPreselected(null);
  }, []);

  const view = useMemo(() => {
    const byAnimal = new Map<string, { due: number; overdue: number; nextVisit?: string }>();
    for (const item of data.agenda) {
      const entry = byAnimal.get(item.animalId) ?? { due: 0, overdue: 0 };
      const status = careStatusOf(item, now);
      if (status === 'due') entry.due++;
      if (status === 'overdue') entry.overdue++;
      if (item.type === 'vet_appointment' && (status === 'due' || status === 'planned') && !entry.nextVisit) entry.nextVisit = item.date;
      byAnimal.set(item.animalId, entry);
    }
    const alerts = sortAlerts(
      animals.flatMap((animal) => {
        const detail = data.details[animal.id];
        return detail ? animalAlerts({ animal, ...detail }, now) : [];
      }),
    );
    const tips = animals
      .map((animal) => ({ animal, tip: speciesTip(data.species[animal.speciesId], data.speciesHealth[animal.speciesId], locale) }))
      .filter((entry) => entry.tip !== null);
    // Un conseil par jour, à tour de rôle entre les animaux qui en ont un.
    const dayIndex = Math.floor(now.getTime() / 86_400_000);
    return {
      summary: summarizeAgenda(data.agenda, now),
      byAnimal,
      alerts,
      tip: tips.length > 0 ? tips[dayIndex % tips.length] : null,
      timeline: timelineItems(data.agenda, now),
    };
  }, [data.agenda, data.details, data.species, data.speciesHealth, animals, now, locale]);

  // Sans session : « Essayer sans compte » ou connexion (jamais de redirection forcée).
  if (!authLoading && !user) return <GuestEntry />;

  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }).format(now);
  const timeFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });

  const statusLabels = {
    done: t('today.status.done'),
    due: t('today.status.due'),
    overdue: t('today.status.overdue'),
    planned: t('today.status.planned'),
    skipped: t('today.status.skipped'),
  };

  const header = (
    <SectionHeader
      title={t('today.title')}
      marginNote={dateLabel}
      marginLabel={t('today.dateLabel')}
      actions={
        animals.length > 0 && canAddAnimal ? <Button onClick={() => setAddOpen(true)}>{t('animals.addAnimal')}</Button> : undefined
      }
    />
  );

  if (authLoading || data.status === 'loading') {
    return (
      <div className="cv-container grid gap-6 py-6 sm:py-8">
        <TodaySkeleton label={t('today.loading')} />
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div className="cv-container grid gap-6 py-6 sm:py-8">
        {header}
        <Alert
          severity="urgent"
          title={t('today.loadError')}
          action={
            <Button variant="secondary" size="sm" onClick={data.reload}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const alertText = (alert: AnimalAlert) => {
    const when = alert.days !== undefined ? formatRelativeDays(alert.days, locale) : '';
    const date = alert.date ? dateFormat.format(new Date(alert.date)) : '';
    const values = { name: alert.animalName, subject: alert.subject ?? '', when, date };
    const key = alert.kind === 'treatment' && !alert.date ? 'treatmentOpen' : alert.kind === 'weighingStale' ? 'weighingOld' : alert.kind;
    return { title: t(`today.alerts.${key}.title`, values), body: t(`today.alerts.${key}.body`, values) };
  };

  const shownAlerts = view.alerts.slice(0, MAX_ALERTS);
  const hiddenAlerts = view.alerts.length - shownAlerts.length;

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <GuestSaveBanner animalName={animals[0]?.name} />
      {header}

      {animals.length === 0 ? (
        <section aria-labelledby="onboarding-title" className="grid gap-8 md:grid-cols-12">
          <Card padding="lg" className="md:col-span-7">
            <div className="mb-6 grid gap-2">
              <h2 id="onboarding-title" className="m-0 font-display text-h2 text-ink">
                {t('onboarding.title')}
              </h2>
              <p className="m-0 max-w-prose text-body text-ink-2">{t('onboarding.text')}</p>
            </div>
            {token ? (
              <AddAnimalFlow
                key={preselected?.id ?? 'new'}
                token={token}
                isGuest={guest}
                preselected={preselected}
                onCreated={onCreated}
                onRoutinesAdded={onRoutinesAdded}
                onClose={() => setPreselected(null)}
                cancellable={false}
              />
            ) : null}
          </Card>
          <div className="grid content-start gap-5 md:col-span-5 md:pt-4">
            {/* Une vraie photo plutôt qu'une silhouette : l'essai prolonge la landing. */}
            <CommonsPhoto photo="dogGoldenRetriever" ratio="4/3" />
            <h2 id="perks-title" className="m-0 font-display text-h3 text-ink">
              {t('onboarding.perksTitle')}
            </h2>
            <ol className="m-0 grid list-none gap-4 p-0">
              {[1, 2, 3].map((n) => (
                <li key={n} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-line pt-4">
                  <span className="font-mono text-meta text-ink-2">{String(n).padStart(2, '0')}</span>
                  <div className="grid gap-1">
                    <p className="m-0 font-medium text-ink">{t(`onboarding.perk${n}Title`)}</p>
                    <p className="m-0 text-ui text-ink-2">{t(`onboarding.perk${n}`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-live="polite">
            {data.agendaStatus === 'ready' ? (
              <>
                <TaskPill count={view.summary.due} label={t('today.pillDue', { count: view.summary.due })} />
                {view.summary.overdue > 0 ? (
                  <TaskPill count={view.summary.overdue} tone="danger" label={t('today.pillOverdue', { count: view.summary.overdue })} />
                ) : null}
                {view.summary.appointments > 0 ? (
                  <TaskPill
                    count={view.summary.appointments}
                    tone="neutral"
                    label={t('today.pillAppointments', { count: view.summary.appointments })}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          {shownAlerts.length > 0 ? (
            <section aria-labelledby="alerts-title" className="grid gap-2">
              <h2 id="alerts-title" className="sr-only">
                {t('today.alertsTitle')}
              </h2>
              <ul className="m-0 grid list-none gap-2 p-0">
                {shownAlerts.map((alert) => {
                  const text = alertText(alert);
                  const severity = alert.level === 'urgent' ? 'urgent' : alert.level === 'warning' ? 'warning' : 'info';
                  return (
                    <li key={`${alert.animalId}-${alert.kind}-${alert.subject ?? ''}`}>
                      <Alert
                        severity={severity}
                        severityLabel={alert.level === 'urgent' ? t('today.urgent') : undefined}
                        title={text.title}
                        action={
                          alert.level !== 'info' ? (
                            <Link href={animalDetailPath(alert.animalId)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                              {t('today.openSheet', { name: alert.animalName })}
                            </Link>
                          ) : undefined
                        }
                      >
                        {text.body}
                      </Alert>
                    </li>
                  );
                })}
              </ul>
              {hiddenAlerts > 0 ? <p className="m-0 text-ui text-ink-2">{t('today.moreAlerts', { count: hiddenAlerts })}</p> : null}
            </section>
          ) : null}

          {/* Bureau : frise à gauche sur deux rangées ; animaux puis repères à droite.
              Mobile : les animaux d'abord, puis la frise, puis l'offre et le conseil. */}
          <div className="grid gap-6 md:grid-flow-dense md:grid-cols-12 md:grid-rows-[auto_1fr]">
            <Card
              as="section"
              title={t('today.timelineTitle')}
              titleId="timeline-title"
              actions={
                <Link href="/agenda" className={buttonClasses({ variant: 'quiet', size: 'sm' })}>
                  {t('today.fullAgenda')}
                </Link>
              }
              className="self-start md:col-span-7 md:row-span-2"
            >
              {data.agendaStatus === 'loading' ? (
                <SkeletonGroup label={t('agenda.loading')} className="grid gap-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4">
                      <Skeleton width="80%" />
                      <Skeleton width={`${70 - i * 12}%`} />
                    </div>
                  ))}
                </SkeletonGroup>
              ) : data.agendaStatus === 'error' ? (
                <Alert
                  severity="warning"
                  title={t('today.agendaError')}
                  action={
                    <Button variant="secondary" size="sm" onClick={data.reloadAgenda}>
                      {t('common.retry')}
                    </Button>
                  }
                />
              ) : view.timeline.length === 0 ? (
                <EmptyState
                  title={t('today.timelineEmptyTitle')}
                  benefit={t('today.timelineEmptyBenefit')}
                  action={
                    <Link href={animalDetailPath(animals[0].id)} className={buttonClasses({ size: 'sm' })}>
                      {t('today.timelineEmptyAction')}
                    </Link>
                  }
                />
              ) : (
                <CareTimeline
                  label={t('today.timelineLabel')}
                  allDayLabel={t('today.allDayShort')}
                  statusLabels={statusLabels}
                  items={view.timeline.map((item) => ({
                    id: item.id,
                    date: item.allDay ? `${displayDay(item)}T12:00:00` : item.date,
                    allDay: item.allDay,
                    title: item.title,
                    detail: [animals.length > 1 ? item.animalName : null, item.detail].filter(Boolean).join(' · ') || undefined,
                    status: careStatusOf(item, now),
                    kind: t(`agenda.types.${item.type}`),
                  }))}
                />
              )}
            </Card>

            <section aria-labelledby="animals-title" className="order-first grid content-start gap-4 md:order-none md:col-span-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="animals-title" className="m-0 font-display text-h3 text-ink">
                  {t('today.animalsTitle')}
                </h2>
                <Link href="/mes-animaux/liste" className={buttonClasses({ variant: 'quiet', size: 'sm' })}>
                  {t('today.allAnimals', { count: animals.length })}
                </Link>
              </div>
              {animals.map((animal) => {
                const species = data.species[animal.speciesId];
                const detail = data.details[animal.id];
                const weighing = detail?.measurements ? lastWeighing(detail.measurements) : null;
                const age = ageOf(animal.birthDate, now);
                const care = view.byAnimal.get(animal.id);
                const latin = latinName(species, (animal as { speciesName?: string }).speciesName);
                const facts = [
                  {
                    label: t('today.factWeight'),
                    value: weighing
                      ? (
                          <>
                            {formatWeight(weighing.weightKg, locale)}
                            <span className="font-sans text-ink-2"> · {formatRelativeDays(daysFrom(weighing.measuredAt, now), locale)}</span>
                          </>
                        )
                      : detail?.measurements
                        ? t('today.factNoWeight')
                        : '—',
                  },
                  {
                    label: t('today.factNextVisit'),
                    value: care?.nextVisit ? timeFormat.format(new Date(care.nextVisit)) : t('today.factNoVisit'),
                  },
                  ...(age ? [{ label: t('today.factAge'), value: formatAge(age, locale) }] : []),
                ];
                return (
                  <AnimalCard
                    key={animal.id}
                    name={animal.name}
                    latin={latin}
                    kind={silhouetteKindOf(species?.class ?? species?.profile?.category)}
                    photo={animal.photos?.[0] ? { src: animal.photos[0], alt: t('today.photoAlt', { name: animal.name }), userPhoto: true } : undefined}
                    href={animalDetailPath(animal.id)}
                    linkAs={Link}
                    headingLevel={3}
                    ratio="16/9"
                    sizes="(min-width: 768px) 40vw, 100vw"
                    status={
                      data.agendaStatus === 'ready' ? (
                        <>
                          <TaskPill count={care?.due ?? 0} label={t('today.pillDue', { count: care?.due ?? 0 })} />
                          {care?.overdue ? (
                            <TaskPill count={care.overdue} tone="danger" label={t('today.pillOverdue', { count: care.overdue })} />
                          ) : null}
                        </>
                      ) : undefined
                    }
                    facts={facts}
                  />
                );
              })}
            </section>

            {!canAddAnimal || view.tip ? (
              <div className="grid content-start gap-4 md:col-span-5">
              {!canAddAnimal ? <AddAnimalLockedSlot isGuest={guest} /> : null}
              {view.tip ? (
                <Tip
                  label={t('today.tipLabel')}
                  source={t('today.tipSource', {
                    species: commonName(data.species[view.tip.animal.speciesId], locale) ?? latinName(data.species[view.tip.animal.speciesId]) ?? '',
                  })}
                >
                  {view.tip.tip?.kind === 'prevention'
                    ? t('today.tipPrevention', { topic: view.tip.tip.topic, text: view.tip.tip.text })
                    : view.tip.tip?.kind === 'habitat'
                      ? view.tip.tip.temperature && view.tip.tip.humidity
                        ? t('today.tipHabitat', { temperature: view.tip.tip.temperature, humidity: view.tip.tip.humidity })
                        : view.tip.tip.temperature
                          ? t('today.tipTemperature', { temperature: view.tip.tip.temperature })
                          : t('today.tipHumidity', { humidity: view.tip.tip.humidity ?? '' })
                      : null}
                </Tip>
              ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}

      <Modal
        open={addOpen}
        onClose={closeAdd}
        size="lg"
        title={t('animals.addAnimal')}
        dismissible={!addBusy}
        closeOnOverlayClick={false}
      >
        {addOpen && token ? (
          <AddAnimalFlow
            token={token}
            isGuest={guest}
            preselected={preselected}
            onCreated={onCreated}
            onRoutinesAdded={onRoutinesAdded}
            onClose={closeAdd}
            onBusyChange={setAddBusy}
          />
        ) : null}
      </Modal>

      {toast ? <Toast message={toast} type="success" onClose={closeToast} /> : null}
    </div>
  );
}

// useSearchParams() exige une frontière Suspense (Next.js 16).
export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayPageContent />
    </Suspense>
  );
}
