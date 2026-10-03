'use client';

import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button, buttonClasses } from '@/components/ui';

/**
 * Erreur de rendu d'un segment de route (rendue dans le layout [locale]).
 * Le message technique n'est jamais affiché : seul le `digest` sert de référence au support.
 * Même cadre que la 404 (page de carnet en pointillés), filet brique à gauche.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    // Chargé à la demande : @sentry/nextjs ne pèse pas sur les pages sans erreur.
    // No-op si Sentry n'est pas initialisé (pas de NEXT_PUBLIC_SENTRY_DSN).
    import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => {});
  }, [error]);

  return (
    <div className="cv-container py-12 sm:py-20">
      <section
        role="alert"
        aria-labelledby="error-title"
        className="mx-auto grid max-w-3xl gap-3 rounded-card border border-dashed border-line-strong px-6 py-10 shadow-[inset_3px_0_0_var(--danger)] sm:px-12 sm:py-14"
      >
        <h1 id="error-title" className="m-0 text-h1 text-ink">
          {t('errorTitle')}
        </h1>
        <p className="m-0 max-w-prose text-body text-ink-2">{t('errorDescription')}</p>
        {error.digest ? <p className="m-0 font-mono text-meta text-ink-2">{t('reference', { digest: error.digest })}</p> : null}
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <Button onClick={() => reset()}>{t('retry')}</Button>
          <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
            {t('backHome')}
          </Link>
        </div>
      </section>
    </div>
  );
}
