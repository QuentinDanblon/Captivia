import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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

/** Rendu commun d'un document légal (Server Component, aucun état). */
export async function LegalDocument({ locale, docKey }: { locale: string; docKey: LegalDocKey }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  const doc = getLegalContent(locale)[docKey];
  const fallback = isTranslationFallback(locale);
  const contentLang = locale === 'fr' ? 'fr' : 'en';
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${LEGAL.lastUpdated}T00:00:00Z`),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <article
        lang={contentLang}
        className="mx-auto w-full min-w-0 max-w-3xl break-words px-4 py-8 text-gray-800 sm:px-6 sm:py-12 dark:text-gray-200"
      >
        <header className="mb-8 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">{doc.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300" lang={locale}>
            {t('lastUpdated', { date: updated })}
          </p>
          {fallback && (
            <p
              lang={locale}
              className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
            >
              {t('englishFallback')}
            </p>
          )}
          {hasPendingLegalMarkers() && (
            <div
              role="note"
              lang={locale}
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              <p className="font-semibold">{t('reviewWarning')}</p>
              <p>{t('pendingInfo')}</p>
            </div>
          )}
        </header>

        <nav
          aria-label={t('tableOfContents')}
          lang={locale}
          className="mb-10 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800"
        >
          <p className="mb-2 font-semibold text-gray-900 dark:text-white">{t('tableOfContents')}</p>
          <ol className="space-y-1 text-sm" lang={contentLang}>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {doc.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24 space-y-3"
            >
              <h2 id={`${section.id}-title`} className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
                {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
