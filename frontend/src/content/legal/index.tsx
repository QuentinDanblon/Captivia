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
 * (`SectionHeader`), avertissements en `Alert`, sections numérotées en mono et sommaire en
 * colonne collante à partir de 1024 px (même lecture que la fiche espèce).
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

          <div className="mt-10 grid gap-10 text-body text-ink">
            {doc.sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="grid scroll-mt-24 gap-3">
                <h2 id={`${section.id}-title`} className="m-0 flex items-baseline gap-3 text-h3 text-ink">
                  <span aria-hidden="true" className="font-mono text-meta font-normal text-ink-2">
                    {number(index)}
                  </span>
                  <span>{section.title}</span>
                </h2>
                {section.body}
              </section>
            ))}
          </div>
        </article>

        {/* Sommaire : au-dessus du texte en mobile, colonne collante en bureau. */}
        <nav aria-label={t('tableOfContents')} lang={locale} className="-order-1 min-w-0 lg:order-none lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <p className="m-0 mb-2 text-meta text-ink-2">{t('tableOfContents')}</p>
            <ol className="m-0 grid list-none border-t border-line p-0" lang={contentLang}>
              {doc.sections.map((section, index) => (
                <li key={section.id} className="border-b border-line">
                  <a
                    href={`#${section.id}`}
                    className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 py-2 text-ui text-ink no-underline transition-colors hover:text-accent-text"
                  >
                    <span aria-hidden="true" className="font-mono text-meta text-ink-2">
                      {number(index)}
                    </span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </div>
  );
}
