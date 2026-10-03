import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Alert, SectionHeader } from '@/components/ui';
import { LEGAL, hasPendingLegalMarkers } from '@/lib/legal';
import { buildEnContent } from './en';
import { buildFrContent } from './fr';
import type { LegalContent, LegalDocKey } from './ui';

export type { LegalContent, LegalDocKey } from './ui';

/** Locales disposant d'une rédaction complète ; les autres reçoivent la version anglaise. */
const FULL_LOCALES: readonly string[] = ['fr', 'en'];

export function isTranslationFallback(locale: string): boolean {
  return !FULL_LOCALES.includes(locale);
}

export function getLegalContent(locale: string): LegalContent {
  return locale === 'fr' ? buildFrContent(locale) : buildEnContent(locale);
}

export function legalMetadata(locale: string, key: LegalDocKey): Metadata {
  const doc = getLegalContent(locale)[key];
  return {
    title: doc.title,
    description: doc.description,
  };
}

/**
 * Rendu commun d'un document légal (Server Component, aucun état) : en-tête « planche »
 * (`SectionHeader`), avertissements en `Alert`, sections numérotées en mono, sommaire replié
 * sous le titre en mobile et en colonne collante à partir de 1024 px (comme la fiche espèce).
 */
export async function LegalDocument({ locale, docKey }: { locale: string; docKey: LegalDocKey }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  const doc = getLegalContent(locale)[docKey];
  const fallback = isTranslationFallback(locale);
  const pending = hasPendingLegalMarkers();
  const contentLang = locale === 'fr' ? 'fr' : 'en';
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${LEGAL.lastUpdated}T00:00:00Z`),
  );
  const number = (index: number) => String(index + 1).padStart(2, '0');
  // Les titres rédigés « 1. Objet » perdent leur numéro : la numérotation mono le porte déjà.
  const titleOf = (title: string) => title.replace(/^\d+\.\s+/, '');
  const tocItems = doc.sections.map((section, index) => (
    <li key={section.id} className="border-b border-line">
      <a
        href={`#${section.id}`}
        className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 py-2 text-ui text-ink no-underline transition-colors hover:text-accent-text"
      >
        <span aria-hidden="true" className="font-mono text-meta text-ink-2">
          {number(index)}
        </span>
        <span>{titleOf(section.title)}</span>
      </a>
    </li>
  ));

  return (
    <div className="cv-container py-8 sm:py-12">
      <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12">
        <article lang={contentLang} className="min-w-0 break-words lg:col-span-8">
          <SectionHeader title={doc.title} description={<span lang={locale}>{t('lastUpdated', { date: updated })}</span>} />

          {fallback || pending ? (
            <div className="mt-6 grid gap-3" lang={locale}>
              {fallback ? <Alert severity="info" title={t('englishFallback')} /> : null}
              {pending ? (
                <div role="note">
                  <Alert severity="warning" title={t('reviewWarning')}>
                    {t('pendingInfo')}
                  </Alert>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Sommaire replié sous le titre en dessous de 1024 px (colonne collante au-delà). */}
          <details className="group mt-6 border-y border-line lg:hidden" lang={locale}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-ui font-medium text-ink [&::-webkit-details-marker]:hidden">
              <span>
                {t('tableOfContents')} <span className="font-mono text-meta font-normal text-ink-2">· {doc.sections.length}</span>
              </span>
              <span aria-hidden="true" className="font-mono text-ink-2 transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <nav aria-label={t('tableOfContents')}>
              <ol className="m-0 mb-3 grid list-none border-t border-line p-0" lang={contentLang}>
                {tocItems}
              </ol>
            </nav>
          </details>

          <div className="mt-10 grid gap-10 text-body text-ink">
            {doc.sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="grid scroll-mt-24 gap-3">
                <h2 id={`${section.id}-title`} className="m-0 flex items-baseline gap-3 text-h3 text-ink">
                  <span aria-hidden="true" className="font-mono text-meta font-normal text-ink-2">
                    {number(index)}
                  </span>
                  <span>{titleOf(section.title)}</span>
                </h2>
                {section.body}
              </section>
            ))}
          </div>
        </article>

        {/* Sommaire en colonne collante à partir de 1024 px. */}
        <nav aria-label={t('tableOfContents')} lang={locale} className="hidden min-w-0 lg:col-span-4 lg:block">
          <div className="sticky top-24">
            <p className="m-0 mb-2 text-meta text-ink-2">{t('tableOfContents')}</p>
            <ol className="m-0 grid list-none border-t border-line p-0" lang={contentLang}>
              {tocItems}
            </ol>
          </div>
        </nav>
      </div>
    </div>
  );
}
