'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { MarketingFrame } from '@/components/frames/MarketingFrame';
import { AnimalSilhouette, buttonClasses } from '@/components/ui';

/**
 * 404 Captivia, rendue dans le layout [locale] (polices, traductions) : elle apporte son propre cadre
 * (`MarketingFrame` : en-tête, `<main>`, pied), car aucun layout de groupe n'enveloppe cette page.
 * Déclenchée par notFound() : routes inconnues via [...rest]/page.tsx, fiches introuvables, etc.
 * Une page de carnet restée blanche : cadre en pointillés, silhouette au trait, code en mono.
 */
export default function LocaleNotFound() {
  const t = useTranslations('errors');

  return (
    <MarketingFrame>
      <div className="cv-container py-12 sm:py-20">
        <section
          aria-labelledby="not-found-title"
          className="mx-auto grid max-w-3xl items-center gap-x-10 gap-y-6 rounded-card border border-dashed border-line-strong px-6 py-10 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-12 sm:py-14"
        >
          <div aria-hidden="true" className="grid justify-items-start gap-3 text-ink-3 sm:justify-items-center">
            <AnimalSilhouette kind="bird" size={96} />
            <span className="font-mono text-meta text-ink-2">fig. 404</span>
          </div>
          <div className="grid gap-3">
            <h1 id="not-found-title" className="m-0 text-h1 text-ink">
              {t('notFoundTitle')}
            </h1>
            <p className="m-0 max-w-prose text-body text-ink-2">{t('notFoundDescription')}</p>
            <p className="m-0 pt-2">
              <Link href="/" className={buttonClasses()}>
                {t('backHome')}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </MarketingFrame>
  );
}
