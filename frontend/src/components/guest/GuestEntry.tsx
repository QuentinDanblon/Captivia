'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Card, buttonClasses } from '@/components/ui';
import { useStartGuest } from './useStartGuest';

export interface GuestEntryProps {
  /** Appelé une fois la session invité ouverte (ex. rester sur la page courante). */
  onStarted?: () => void;
  className?: string;
}

/**
 * Accueil d'une page de l'app pour un visiteur sans session : « Essayer sans compte » (crée la
 * session invité, sans e-mail ni mot de passe) ou « J'ai déjà un compte ». Remplace la
 * redirection vers la connexion : l'app s'utilise tout de suite.
 */
export function GuestEntry({ onStarted, className }: GuestEntryProps) {
  const t = useTranslations('guest');
  const { start, starting, error } = useStartGuest();

  return (
    <div className={['cv-container py-8 sm:py-12', className].filter(Boolean).join(' ')}>
      <Card as="section" padding="lg" className="mx-auto grid max-w-xl gap-6" aria-labelledby="guest-entry-title">
        <div className="grid gap-2">
          <h1 id="guest-entry-title" className="m-0 font-display text-h2 text-ink">
            {t('entryTitle')}
          </h1>
          <p className="m-0 text-body text-ink-2">{t('entryText')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            size="lg"
            loading={starting}
            onClick={async () => {
              if (await start()) onStarted?.();
            }}
          >
            {starting ? t('entryStarting') : t('entryTry')}
          </Button>
          <Link href="/login" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
            {t('entryLogin')}
          </Link>
        </div>
        {error ? (
          <p role="alert" className="m-0 text-ui font-medium text-danger">
            {error}
          </p>
        ) : null}
        <p className="m-0 text-ui text-ink-2">
          <Link href="/register" className="text-accent-text underline underline-offset-2">
            {t('entryRegister')}
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default GuestEntry;
