'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SectionHeader } from '@/components/ui';

export interface SettingsHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Repère en mono dans la marge (formule, points…). */
  marginNote?: ReactNode;
  marginLabel?: string;
  actions?: ReactNode;
}

/**
 * En-tête des sous-pages de « Compte » (/parametres/*) : lien de retour vers l'index, puis
 * l'en-tête « planche » (titre Fraunces, double filet).
 */
export function SettingsHeader({ title, description, marginNote, marginLabel, actions }: SettingsHeaderProps) {
  const t = useTranslations('settings');
  return (
    <div className="grid gap-4">
      <nav aria-label={t('breadcrumbLabel')}>
        <Link
          href="/parametres"
          className="inline-flex min-h-11 items-center gap-1.5 text-ui text-ink-2 no-underline transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('title')}
        </Link>
      </nav>
      <SectionHeader title={title} description={description} marginNote={marginNote} marginLabel={marginLabel} actions={actions} />
    </div>
  );
}

export default SettingsHeader;
