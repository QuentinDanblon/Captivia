'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from '@/i18n/navigation';
import { isGuestUser } from '@/lib/guest';
import { languageNames } from '@/components/LanguageSelector';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { GuestSaveBanner } from '@/components/guest/GuestSaveBanner';
import { Badge, Button, Card, PremiumBadge, SectionHeader, Skeleton, SkeletonGroup } from '@/components/ui';

interface SettingsEntry {
  href: string;
  title: string;
  description: string;
  status?: ReactNode;
}

/**
 * Index « Compte » (onglet de l'app) : la table des matières des réglages — profil et sécurité,
 * rappels, abonnement, grade — et, à côté, la carte du profil.
 */
export default function ParametresPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, isLoading: authLoading, logout } = useAuth();

  // Sans session : « Essayer sans compte » ou connexion (plus de redirection vers /login).
  if (!authLoading && !user) return <GuestEntry />;

  if (authLoading || !user) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('common.loading')} className="grid gap-6">
          <Skeleton width="35%" height={40} />
          <div className="grid gap-6 md:grid-cols-12">
            <Skeleton shape="block" height={360} className="md:col-span-8" />
            <Skeleton shape="block" height={200} className="md:col-span-4" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  const guest = isGuestUser(user);
  const premium = !guest && user.isPremium;
  const createdAt = (user as { createdAt?: string }).createdAt;
  const memberSince = createdAt
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(createdAt))
    : null;
  const initials = user.email?.slice(0, 2).toUpperCase() ?? '··';

  const entries: SettingsEntry[] = [
    { href: '/parametres/compte', title: t('settings.accountTitle'), description: t('settings.accountDescription') },
    {
      href: '/parametres/notifications',
      title: t('settings.notificationsTitle'),
      description: t('settings.notificationsDescription'),
    },
    {
      href: '/parametres/abonnement',
      title: t('settings.subscriptionTitle'),
      description: premium ? t('settings.subscriptionDescriptionPremium') : t('settings.subscriptionDescription'),
      status: premium ? <PremiumBadge label={t('guest.premium')} /> : <Badge>{t('settings.planFree')}</Badge>,
    },
    { href: '/parametres/grade', title: t('settings.gradeTitle'), description: t('settings.gradeDescription') },
  ];

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      {/* Invité : l'invitation à créer un compte (sans perte) est le premier réglage. */}
      <GuestSaveBanner dismissible={false} />
      <SectionHeader title={t('settings.title')} description={t('settings.lead')} />

      <div className="grid gap-8 md:grid-cols-12">
        <nav aria-label={t('settings.sectionsLabel')} className="md:col-span-8">
          <ul className="m-0 list-none border-t border-line p-0">
            {entries.map((entry, index) => (
              <li key={entry.href} className="border-b border-line">
                <Link
                  href={entry.href}
                  className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-4 py-5 text-ink no-underline sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
                >
                  <span aria-hidden="true" className="pt-1 font-mono text-meta text-ink-2">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="grid min-w-0 gap-1">
                    <span className="font-display text-h4 font-semibold decoration-1 underline-offset-4 group-hover:underline">
                      {entry.title}
                    </span>
                    <span className="text-ui text-ink-2">{entry.description}</span>
                  </span>
                  <span className="flex items-center gap-3 pt-1">
                    {entry.status}
                    <svg viewBox="0 0 16 16" className="size-4 text-ink-3 transition-colors group-hover:text-ink" fill="none" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Card as="aside" aria-label={t('settings.profileLabel')} className="grid content-start gap-5 self-start md:col-span-4">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-sunken font-mono text-ui text-ink"
            >
              {initials}
            </span>
            <div className="grid min-w-0 gap-0.5">
              <p className="m-0 truncate font-medium text-ink">{user.email ?? t('nav.guest')}</p>
              <p className="m-0 text-ui text-ink-2">
                {guest ? t('settings.guestProfile') : memberSince ? t('settings.memberSince', { date: memberSince }) : t('settings.planFree')}
              </p>
            </div>
          </div>
          <dl className="m-0 grid gap-0 border-t border-line text-ui">
            <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
              <dt className="text-ink-2">{t('settings.planLabel')}</dt>
              <dd className="m-0 text-ink">{premium ? t('guest.premium') : t('settings.planFreeShort')}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
              <dt className="text-ink-2">{t('common.language')}</dt>
              <dd className="m-0 text-ink">{languageNames[locale as keyof typeof languageNames] ?? locale}</dd>
            </div>
          </dl>
          {!guest ? (
            <Button variant="secondary" onClick={logout} fullWidth>
              {t('common.logout')}
            </Button>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
