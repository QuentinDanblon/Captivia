import { getTranslations } from 'next-intl/server';
import {
  Alert,
  AnimalCard,
  Badge,
  buttonClasses,
  Card,
  CareTimeline,
  Figure,
  IucnBadge,
  MediaCard,
  SectionHeader,
  TaskPill,
  Tip,
  type CareStatus,
} from '@/components/ui';
import { PHOTOS, photoSources } from '@/content/photos';
import { PreviewFrame } from './PreviewFrame';
import { WeightCurve } from './WeightCurve';
import {
  CAT_VACCINES,
  CAT_WEIGHTS,
  GECKO,
  SAMPLE_ANIMALS,
  SAMPLE_AUTHORS,
  SAMPLE_TIME_ZONE,
  SAMPLE_TODAY,
  TODAY_CARE,
  UPCOMING_CARE,
  type SampleCare,
} from './sample';

/*
 * Aperçus d'écrans de l'app sur la landing : composés avec les vrais composants `ui/` (ceux du
 * tableau de bord, du carnet, de l'agenda et des fiches) et des données d'exemple. Les boutons
 * y sont dessinés, pas actifs (`<span>` aux classes de bouton) : l'aperçu est une illustration.
 */

type Props = { locale: string };

async function loadSample(locale: string) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const statusLabels: Record<CareStatus, string> = {
    done: t('sample.status.done'),
    due: t('sample.status.due'),
    overdue: t('sample.status.overdue'),
    planned: t('sample.status.planned'),
    skipped: t('sample.status.skipped'),
  };
  const toItems = (care: SampleCare[]) =>
    care.map((c) => ({
      id: c.id,
      date: c.date,
      allDay: c.allDay,
      status: c.status,
      title: t(`sample.care.${c.care}Title`),
      detail: t(`sample.care.${c.care}Detail`),
      kind: t(`sample.kind.${c.kind}`),
      action: c.actionable ? (
        <span className={buttonClasses({ variant: 'secondary', size: 'sm' })}>{t('sample.markDone')}</span>
      ) : undefined,
    }));
  return { t, statusLabels, toItems };
}

const dayLabel = (locale: string, iso: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short', timeZone: SAMPLE_TIME_ZONE }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/** Écran « Aujourd'hui » (hero) : pastilles du jour, alerte, frise des soins. */
export async function TodayPreview({ locale, className }: Props & { className?: string }) {
  const { t, statusLabels, toItems } = await loadSample(locale);
  const due = TODAY_CARE.filter((c) => c.date.startsWith(SAMPLE_TODAY)).length;
  const overdue = TODAY_CARE.filter((c) => c.status === 'overdue').length;
  const dueLabel = t('sample.dueToday', { count: due });
  const overdueLabel = t('sample.overdue', { count: overdue });

  return (
    <PreviewFrame
      className={className}
      note={t('tour.previewNote')}
      description={`${t('hero.previewCaption')} ${due} ${dueLabel}, ${overdue} ${overdueLabel}.`}
    >
      <div className="grid gap-4">
        <SectionHeader level={3} title={t('sample.today')} marginNote={dayLabel(locale, SAMPLE_TODAY)} />
        <div className="flex flex-wrap gap-2">
          <TaskPill count={due} label={dueLabel} />
          <TaskPill count={overdue} tone="danger" label={overdueLabel} />
        </div>
        <CareTimeline
          label={t('sample.timelineLabel')}
          statusLabels={statusLabels}
          allDayLabel={t('sample.allDay')}
          items={toItems(TODAY_CARE)}
          locale={locale}
          timeZone={SAMPLE_TIME_ZONE}
          background="paper"
        />
      </div>
    </PreviewFrame>
  );
}

/** Carnet de santé de Moka : carte de l'animal, vaccins, courbe de poids. */
export async function HealthRecordPreview({ locale }: Props) {
  const { t } = await loadSample(locale);
  const cat = photoSources('catStraw');
  const dateFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: SAMPLE_TIME_ZONE });

  return (
    <PreviewFrame note={t('tour.previewNote')} description={`${t('tour.record.title')} ${t('sample.weightChart')}.`} credits={[PHOTOS.catStraw.credit]}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AnimalCard
          name={SAMPLE_ANIMALS.cat}
          latin="Felis catus"
          kind="mammal"
          headingLevel={4}
          photo={{ ...cat, alt: '', sizes: '(min-width: 1024px) 220px, 90vw', creditPlacement: 'external' }}
          status={<Badge tone="warn" dot>{t('sample.vaccineDueSoon')}</Badge>}
          facts={[
            { label: t('sample.lastWeighing'), value: t('sample.lastWeighingValue') },
            { label: t('sample.nextVaccine'), value: t('sample.nextVaccineValue') },
          ]}
        />
        <div className="grid content-start gap-4">
          <Card title={t('sample.vaccinesTitle')} headingLevel={4} padding="sm">
            <ul className="m-0 grid list-none gap-2 p-0">
              {CAT_VACCINES.map((v) => (
                <li key={v.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-dotted border-line pb-2 last:border-0 last:pb-0">
                  <span className="text-ui text-ink">
                    {t(`sample.${v.key}`)}
                    <span className="ml-2 font-mono text-meta text-ink-2">{dateFormat.format(new Date(`${v.date}T12:00:00Z`))}</span>
                  </span>
                  <Badge tone={v.status === 'dueSoon' ? 'warn' : 'ok'}>
                    {t(v.status === 'dueSoon' ? 'sample.vaccineDueSoon' : 'sample.vaccineUpToDate')}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t('sample.weightTitle')} headingLevel={4} padding="sm" actions={<span className="font-mono text-meta text-ink-2">kg</span>}>
            <WeightCurve points={CAT_WEIGHTS} locale={locale} label={t('sample.weightChart')} />
          </Card>
        </div>
      </div>
    </PreviewFrame>
  );
}

/** Agenda : rendez-vous à prendre, frise des soins à venir. */
export async function RemindersPreview({ locale }: Props) {
  const { t, statusLabels, toItems } = await loadSample(locale);
  return (
    <PreviewFrame note={t('tour.previewNote')} description={`${t('sample.appointmentTitle')}. ${t('tour.reminders.title')}`}>
      <div className="grid gap-4">
        <Alert
          severity="info"
          title={t('sample.appointmentTitle')}
          action={<span className={buttonClasses({ variant: 'secondary', size: 'sm' })}>{t('sample.alertAction')}</span>}
        >
          {t('sample.appointmentBody')}
        </Alert>
        <Card title={t('sample.weekLabel')} headingLevel={4} padding="sm">
          <CareTimeline
            label={t('sample.weekLabel')}
            statusLabels={statusLabels}
            allDayLabel={t('sample.allDay')}
            items={toItems(UPCOMING_CARE)}
            locale={locale}
            timeZone={SAMPLE_TIME_ZONE}
          />
        </Card>
      </div>
    </PreviewFrame>
  );
}

/** Fiche espèce : planche naturaliste du gecko léopard. */
export async function SpeciesPreview({ locale }: Props) {
  const { t } = await loadSample(locale);
  const gecko = photoSources('leopardGecko');
  const facts: [string, string][] = [
    [t('sample.geckoFacts.hotSpot'), GECKO.hotSpot],
    [t('sample.geckoFacts.activity'), t('sample.geckoFacts.activityValue')],
    [t('sample.geckoFacts.diet'), t('sample.geckoFacts.dietValue')],
    [t('sample.geckoFacts.lifespan'), t('sample.geckoFacts.lifespanValue')],
  ];
  return (
    <PreviewFrame note={t('tour.previewNote')} description={`${t('sample.geckoName')}, ${GECKO.latin}. ${t('tour.species.title')}`} credits={[PHOTOS.leopardGecko.credit]}>
      <div className="grid gap-4">
        <SectionHeader level={3} title={t('sample.geckoName')} latin={GECKO.latin} authority={GECKO.authority} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Figure {...gecko} alt="" ratio="3/2" creditPlacement="external" fallbackKind="reptile" sizes="(min-width: 1024px) 260px, 90vw" />
          <dl className="m-0 grid content-start gap-1.5 text-ui">
            {facts.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-dotted border-line pb-1.5">
                <dt className="text-ink-2">{label}</dt>
                <dd className="m-0 text-right font-mono text-meta text-ink">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <dt className="text-ink-2">{t('sample.geckoStatus')}</dt>
              <dd className="m-0">
                <IucnBadge category="LC" label={t('sample.geckoLc')} />
              </dd>
            </div>
          </dl>
        </div>
        <Tip label={t('sample.geckoTipLabel')} source={t('sample.geckoSources')}>
          {t('sample.geckoTip')}
        </Tip>
      </div>
    </PreviewFrame>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft font-mono text-meta text-accent-text">
      {name.slice(0, 1)}
    </span>
  );
}

/** Communauté (à venir) : deux publications, réactions et réponses. */
export async function CommunityPreview({ locale }: Props) {
  const { t } = await loadSample(locale);
  const cockatiels = photoSources('cockatiels');
  const footer = (reactions: number, replies: number) => (
    <span className="flex gap-3 font-mono text-meta text-ink-2">
      <span>{t('sample.reactions', { count: reactions })}</span>
      <span>{t('sample.replies', { count: replies })}</span>
    </span>
  );
  const header = (name: string, time: string) => (
    <span className="flex items-center gap-2">
      <Avatar name={name} />
      <span className="font-medium text-ink">{name}</span>
      <span className="font-mono">{time}</span>
    </span>
  );

  return (
    <PreviewFrame note={t('tour.previewNote')} description={t('tour.community.title')} credits={[PHOTOS.cockatiels.credit]}>
      <div className="grid gap-4 sm:grid-cols-2">
        <MediaCard
          media={<Figure {...cockatiels} alt="" ratio="4/3" creditPlacement="external" fallbackKind="bird" sizes="(min-width: 1024px) 260px, 90vw" />}
          header={header(SAMPLE_AUTHORS.cockatiels, t('sample.postCockatielsTime'))}
          title={t('sample.postCockatielsTitle')}
          headingLevel={4}
          footer={footer(14, 3)}
        />
        <MediaCard
          header={header(SAMPLE_AUTHORS.question, t('sample.postQuestionTime'))}
          title={t('sample.postQuestionTitle')}
          headingLevel={4}
          footer={footer(6, 9)}
        >
          <p className="m-0 text-ink-2">{t('sample.postQuestionBody')}</p>
        </MediaCard>
      </div>
    </PreviewFrame>
  );
}
