'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Erreur de rendu d'un segment de route (rendue dans le layout [locale]).
 * Le message technique n'est jamais affiché : seul le `digest` sert de référence au support.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const locale = useLocale();

  useEffect(() => {
    // Chargé à la demande : @sentry/nextjs ne pèse pas sur les pages sans erreur.
    // No-op si Sentry n'est pas initialisé (pas de NEXT_PUBLIC_SENTRY_DSN).
    import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => {});
  }, [error]);

  return (
    <section
      role="alert"
      aria-labelledby="error-title"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
    >
      <h1 id="error-title" className="text-2xl font-semibold text-[var(--captivia-ink)] sm:text-3xl">
        {t('errorTitle')}
      </h1>
      <p className="mt-3 max-w-md text-base text-[var(--captivia-muted)]">{t('errorDescription')}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-[var(--captivia-muted)]">{t('reference', { digest: error.digest })}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-xl bg-[#067256] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#055a44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#067256]"
        >
          {t('retry')}
        </button>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--captivia-border-strong)] px-6 py-3 text-sm font-semibold text-[var(--captivia-ink)] transition-colors hover:bg-[var(--captivia-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#067256]"
        >
          {t('backHome')}
        </Link>
      </div>
    </section>
  );
}
