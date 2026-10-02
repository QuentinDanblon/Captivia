'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

/**
 * 404 Captivia, rendue dans le layout [locale] (en-tête, traductions).
 * Déclenchée par notFound() : routes inconnues via [...rest]/page.tsx, fiches introuvables, etc.
 */
export default function LocaleNotFound() {
  const t = useTranslations('errors');
  const locale = useLocale();

  return (
    <section
      aria-labelledby="not-found-title"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
    >
      <p
        aria-hidden="true"
        className="text-7xl font-bold tracking-tight text-[var(--captivia-accent-dark)] sm:text-8xl"
      >
        404
      </p>
      <h1 id="not-found-title" className="mt-4 text-2xl font-semibold text-[var(--captivia-ink)] sm:text-3xl">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-3 max-w-md text-base text-[var(--captivia-muted)]">{t('notFoundDescription')}</p>
      <Link
        href={`/${locale}`}
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#067256] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#055a44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#067256]"
      >
        {t('backHome')}
      </Link>
    </section>
  );
}
