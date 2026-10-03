import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LEGAL_ROUTES } from '@/lib/legal';
import { Badge, buttonClasses, cx, Figure, PremiumBadge, SectionHeader, type SilhouetteKind } from '@/components/ui';
import { photoSources, type PhotoKey } from '@/content/photos';
import { CommunityPreview, HealthRecordPreview, RemindersPreview, SpeciesPreview, TodayPreview } from './AppPreviews';
import { SpeciesSearch } from './SpeciesSearch';

/*
 * Sections de la landing, dans l'ordre de lecture : accroche et aperçu réel → aperçus du carnet,
 * de l'agenda, des fiches et de la communauté → espèces → mise en route → offre → confiance →
 * recherche → questions → dernier appel. Textes : namespace `landing` (docs/MESSAGING.md).
 */

/** Entrée de l'app : elle propose l'essai sans compte (mode invité). */
export const APP_ENTRY = '/mes-animaux';
const LOGIN = '/login';

type Props = { locale: string };

function Section({
  id,
  labelledBy,
  tone = 'paper',
  className,
  children,
}: {
  id?: string;
  labelledBy: string;
  tone?: 'paper' | 'surface' | 'sunken';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx(
        'cv-deferred border-t border-line py-12 sm:py-18',
        tone === 'surface' && 'bg-surface',
        tone === 'sunken' && 'bg-sunken',
        className,
      )}
    >
      <div className="cv-container">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------- */

export async function Hero({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const dog = photoSources('dogRiver');

  return (
    <section aria-labelledby="landing-title" className="overflow-hidden">
      <div className="cv-container grid gap-x-12 gap-y-10 pt-8 pb-14 sm:pt-12 lg:grid-cols-12 lg:items-center lg:pt-16 lg:pb-28">
        <div className="lg:col-span-5">
          <h1 id="landing-title" className="m-0 text-display text-ink">
            <span className="block">{t('hero.titleLead')}</span>
            <span className="block italic text-accent-text">{t('hero.titleRest')}</span>
          </h1>
          <p className="mt-6 mb-0 max-w-[34rem] text-body text-ink-2 sm:text-[1.125rem] sm:leading-relaxed">{t('hero.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={APP_ENTRY} className={buttonClasses({ size: 'lg' })}>
              {t('hero.ctaPrimary')}
            </Link>
            <Link href={LOGIN} className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <p className="mt-3 mb-0 text-ui text-ink-2">{t('hero.reassurance')}</p>
          <p className="mt-8 mb-0 border-t border-line pt-3 font-mono text-meta text-ink-2">{t('hero.species')}</p>
        </div>

        <div className="relative lg:col-span-7">
          <Figure
            {...dog}
            alt={t('hero.photoAlt')}
            ratio="4/3"
            treatment="grain"
            priority
            creditPlacement="overlay"
            creditCorner="top"
            objectPosition="62% 50%"
            sizes="(min-width: 1200px) 680px, (min-width: 1024px) 56vw, 100vw"
            className="[&_.cv-photo]:rounded-card"
          />
          <TodayPreview
            locale={locale}
            className="relative mx-3 -mt-12 sm:mx-auto sm:w-[25rem] lg:absolute lg:-bottom-18 lg:-left-12 lg:mx-0 lg:mt-0 lg:w-[22rem]"
          />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------- */

function TourRow({
  index,
  label,
  title,
  body,
  badge,
  preview,
  reverse = false,
}: {
  index: number;
  label: string;
  title: string;
  body: string;
  badge?: ReactNode;
  preview: ReactNode;
  reverse?: boolean;
}) {
  return (
    <li className="grid items-center gap-x-12 gap-y-6 lg:grid-cols-12">
      <div className={cx('lg:col-span-5', reverse && 'lg:order-2 lg:col-start-8')}>
        <p className="m-0 flex items-center gap-3 font-mono text-meta text-ink-2">
          <span aria-hidden="true">{String(index).padStart(2, '0')}</span>
          <span>{label}</span>
          {badge}
        </p>
        <h3 className="mt-3 mb-0 text-h3 text-ink">{title}</h3>
        <p className="mt-3 mb-0 max-w-[32rem] text-body text-ink-2">{body}</p>
      </div>
      <div className={cx('min-w-0 lg:col-span-7', reverse && 'lg:order-1 lg:col-start-1 lg:row-start-1')}>{preview}</div>
    </li>
  );
}

export async function Tour({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const soon = (
    <Badge tone="accent" dot>
      {t('tour.soon')}
    </Badge>
  );
  return (
    <Section labelledBy="landing-tour" tone="surface">
      <SectionHeader level={2} id="landing-tour" title={t('tour.title')} description={t('tour.intro')} />
      <ol className="m-0 mt-12 grid list-none gap-12 p-0 sm:gap-18">
        <TourRow index={1} label={t('tour.record.label')} title={t('tour.record.title')} body={t('tour.record.body')} preview={<HealthRecordPreview locale={locale} />} />
        <TourRow index={2} reverse label={t('tour.reminders.label')} title={t('tour.reminders.title')} body={t('tour.reminders.body')} preview={<RemindersPreview locale={locale} />} />
        <TourRow index={3} label={t('tour.species.label')} title={t('tour.species.title')} body={t('tour.species.body')} preview={<SpeciesPreview locale={locale} />} />
        <TourRow index={4} reverse label={t('tour.community.label')} title={t('tour.community.title')} body={t('tour.community.body')} badge={soon} preview={<CommunityPreview locale={locale} />} />
      </ol>
    </Section>
  );
}

/* -------------------------------------------------------------------------------------------- */

const GALLERY: { key: PhotoKey; kind: SilhouetteKind; position?: string }[] = [
  { key: 'dogGoldenRetriever', kind: 'mammal', position: '40% 50%' },
  { key: 'catTabby', kind: 'mammal', position: '50% 30%' },
  { key: 'rabbitStraw', kind: 'mammal' },
  { key: 'budgerigars', kind: 'bird' },
  { key: 'beardedDragon', kind: 'reptile' },
  { key: 'neonTetra', kind: 'fish' },
  { key: 'horse', kind: 'mammal', position: '60% 50%' },
  { key: 'hen', kind: 'bird', position: '45% 50%' },
];

export async function Gallery({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  return (
    <Section labelledBy="landing-gallery">
      <SectionHeader level={2} id="landing-gallery" title={t('gallery.title')} description={t('gallery.body')} />
      <ul className="m-0 mt-8 grid list-none grid-cols-2 gap-x-4 gap-y-6 p-0 md:grid-cols-4">
        {GALLERY.map(({ key, kind, position }) => (
          <li key={key}>
            <Figure
              {...photoSources(key)}
              alt={t(`photos.${key}`)}
              caption={t(`galleryNames.${key}`)}
              ratio="4/3"
              fallbackKind={kind}
              objectPosition={position}
              sizes="(min-width: 1200px) 285px, (min-width: 768px) 24vw, 48vw"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------------------------- */

export async function HowItWorks({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const steps = (['one', 'two', 'three'] as const).map((key) => ({ title: t(`steps.${key}.title`), body: t(`steps.${key}.body`) }));
  const grass = photoSources('grassDroplets');
  return (
    <Section labelledBy="landing-steps" tone="surface" className="relative">
      <SectionHeader level={2} id="landing-steps" title={t('steps.title')} />
      <ol className="m-0 mt-8 grid list-none gap-8 p-0 md:grid-cols-3 md:gap-6">
        {steps.map((step, i) => (
          <li key={step.title} className="grid content-start gap-2 border-t-2 border-ink pt-4">
            <span aria-hidden="true" className="font-display text-h1 leading-none text-accent-text">
              {i + 1}
            </span>
            <h3 className="m-0 text-h4 text-ink">{step.title}</h3>
            <p className="m-0 text-body text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href={APP_ENTRY} className={buttonClasses({ size: 'lg' })}>
          {t('steps.cta')}
        </Link>
      </div>
      <div className="mt-12 h-36 sm:h-44">
        <Figure {...grass} alt="" ratio="fill" treatment="grain" creditPlacement="overlay" sizes="(min-width: 1200px) 1200px, 100vw" className="h-full" />
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------------------------- */

function Mark({ included, label }: { included: boolean; label: string }) {
  return included ? (
    <svg viewBox="0 0 16 16" className="mx-auto size-4 text-ok" aria-label={label} role="img">
      <path d="M3.5 8.4 6.6 11.4 12.6 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="mx-auto size-4 text-ink-3" aria-label={label} role="img">
      <path d="M4.5 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export async function Offer({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const yes = t('offer.included');
  const no = t('offer.notIncluded');
  const rows: { label: string; cells: [ReactNode, ReactNode, ReactNode] }[] = [
    {
      label: t('offer.rows.animals'),
      cells: [
        <span key="g" className="font-mono">1</span>,
        <span key="f" className="font-mono">1</span>,
        <span key="p">{t('offer.several')}</span>,
      ],
    },
    ...(['record', 'reminders', 'species'] as const).map((key) => ({
      label: t(`offer.rows.${key}`),
      cells: [<Mark key="g" included label={yes} />, <Mark key="f" included label={yes} />, <Mark key="p" included label={yes} />] as [ReactNode, ReactNode, ReactNode],
    })),
    { label: t('offer.rows.sync'), cells: [<Mark key="g" included={false} label={no} />, <Mark key="f" included label={yes} />, <Mark key="p" included label={yes} />] },
    { label: t('offer.rows.qr'), cells: [<Mark key="g" included={false} label={no} />, <Mark key="f" included={false} label={no} />, <Mark key="p" included label={yes} />] },
  ];
  const plans = [
    { name: t('offer.guest'), price: t('offer.guestPrice'), hint: t('offer.guestHint') },
    { name: t('offer.free'), price: t('offer.freePrice'), hint: t('offer.freeHint') },
    {
      name: (
        <>
          <span className="sm:hidden">{t('offer.premium')}</span>
          <span className="hidden sm:inline">
            <PremiumBadge label={t('offer.premium')} />
          </span>
        </>
      ),
      price: t('offer.premiumPrice'),
      hint: t('offer.premiumHint'),
    },
  ];

  return (
    <Section labelledBy="landing-offer" tone="sunken">
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="landing-offer" className="m-0 text-h2 text-ink">
            {t('offer.title')}
          </h2>
          <p className="mt-4 mb-0 text-body text-ink-2">{t('offer.intro')}</p>
          <p className="mt-4 mb-0 border-l border-line-strong pl-4 text-ui text-ink">{t('offer.keepData')}</p>
          <Link href={APP_ENTRY} className={cx(buttonClasses({ size: 'lg' }), 'mt-8')}>
            {t('offer.cta')}
          </Link>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <div className="rounded-card border border-line bg-surface">
            <table className="w-full table-fixed border-collapse text-ui">
              <caption className="sr-only">{t('offer.caption')}</caption>
              <colgroup>
                <col className="w-[34%] sm:w-[40%]" />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong align-top">
                  <th scope="col" className="p-3 text-left font-normal sm:p-4">
                    <span className="sr-only">{t('offer.feature')}</span>
                  </th>
                  {plans.map((plan, i) => (
                    <th key={i} scope="col" className="px-1 py-3 text-center font-normal sm:p-4">
                      <span className="block font-display text-ui font-semibold text-ink sm:text-h4">{plan.name}</span>
                      <span className="mt-1 block text-meta font-medium text-ink">{plan.price}</span>
                      <span className="mt-0.5 hidden text-meta text-ink-2 sm:block">{plan.hint}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3 pr-2 pl-3 text-left text-meta font-normal text-ink sm:p-4 sm:text-ui">
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="px-1 py-2 text-center text-meta text-ink sm:p-4 sm:text-ui">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 mb-0 text-meta text-ink-2 sm:hidden">{t('offer.premiumHint')}</p>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------------------------- */

const TRUST_ICONS: Record<'private' | 'europe' | 'sources' | 'noAds', ReactNode> = {
  private: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </>
  ),
  europe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z" />
    </>
  ),
  sources: (
    <>
      <path d="M5 4.5h9.5L19 9v10.5H5Z" />
      <path d="M14.5 4.5V9H19M8.5 13h7M8.5 16.5h5" />
    </>
  ),
  noAds: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
};

export async function Trust({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const items = (['private', 'europe', 'sources', 'noAds'] as const).map((key) => ({
    key,
    title: t(`trust.${key}.title`),
    body: t(`trust.${key}.body`),
  }));
  return (
    <Section labelledBy="landing-trust">
      <SectionHeader level={2} id="landing-trust" title={t('trust.title')} />
      <ul className="m-0 mt-8 grid list-none gap-x-8 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.key} className="grid content-start gap-2">
            <svg viewBox="0 0 24 24" className="size-6 text-accent-text" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {TRUST_ICONS[item.key]}
            </svg>
            <h3 className="m-0 text-h4 text-ink">{item.title}</h3>
            <p className="m-0 text-body text-ink-2">{item.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 mb-0 text-ui">
        <Link href={LEGAL_ROUTES.privacy} className="text-accent-text underline decoration-1 underline-offset-2">
          {t('trust.privacyLink')}
        </Link>
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------------------------- */

export async function SearchSection({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const leaves = photoSources('lemonBalm');
  return (
    <section aria-labelledby="landing-search" className="cv-deferred relative isolate border-t border-line py-12 sm:py-18">
      <div className="absolute inset-0 -z-10">
        <Figure {...leaves} alt="" ratio="fill" treatment="duotone" creditPlacement="overlay" sizes="100vw" className="h-full [&_.cv-photo]:rounded-none" />
      </div>
      <div className="cv-container">
        <div className="mx-auto max-w-3xl rounded-card border border-line-strong bg-paper p-4 sm:p-8">
          <h2 id="landing-search" className="m-0 text-h2 text-ink">
            {t('search.title')}
          </h2>
          <p className="mt-3 mb-6 text-body text-ink-2">{t('search.body')}</p>
          <SpeciesSearch />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------- */

const FAQ_KEYS = ['free', 'account', 'upgrade', 'animals', 'vet', 'data', 'devices'] as const;

export async function Faq({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  return (
    <Section labelledBy="landing-faq">
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-12">
        <h2 id="landing-faq" className="m-0 text-h2 text-ink lg:col-span-4">
          {t('faq.title')}
        </h2>
        <div className="border-t-2 border-ink lg:col-span-8">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group border-b border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-h4 text-ink [&::-webkit-details-marker]:hidden">
                {t(`faq.${key}.q`)}
                <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-2 transition-transform group-open:rotate-45" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="m-0 max-w-prose pb-5 text-body text-ink-2">{t(`faq.${key}.a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------------------------- */

export async function FinalCta({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const moss = photoSources('mossForest');
  return (
    <section aria-labelledby="landing-final" className="cv-deferred relative isolate border-t border-line py-18 sm:py-24">
      <div className="absolute inset-0 -z-10">
        <Figure {...moss} alt="" ratio="fill" treatment="duotone" creditPlacement="overlay" sizes="100vw" className="h-full [&_.cv-photo]:rounded-none" />
      </div>
      <div className="cv-container">
        <div className="max-w-xl rounded-card border border-line-strong bg-paper p-6 sm:p-8">
          <h2 id="landing-final" className="m-0 text-h1 text-ink">
            {t('final.title')}
          </h2>
          <p className="mt-4 mb-0 text-body text-ink-2">{t('final.body')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={APP_ENTRY} className={buttonClasses({ size: 'lg' })}>
              {t('final.cta')}
            </Link>
            <Link href={LOGIN} className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
              {t('final.secondary')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
