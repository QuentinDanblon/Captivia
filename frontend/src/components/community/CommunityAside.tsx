'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { communityProfilePath } from '@/lib/platform';
import { Card, buttonClasses, cx } from '@/components/ui';
import { useCommunity } from './CommunityGate';
import { CommunityAvatar } from './primitives';

/** Rôle opérateur (`GET /auth/me`) : affiche l'accès à la file de modération. */
export function useIsOperator(token: string): boolean {
  const [operator, setOperator] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .getProfile(token)
      .then((profile: { role?: string } | null) => {
        if (!cancelled) setOperator(profile?.role === 'OPERATOR');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);
  return operator;
}

/** Règles en bref : trois repères numérotés, renvoi vers le texte complet. */
export function RulesDigest({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const t = useTranslations('community');
  const Heading = `h${headingLevel}` as const;
  return (
    <Card tone="sunken" padding="md" className="grid gap-3">
      <Heading className="m-0 font-display text-h4 font-semibold text-ink">{t('aside.rulesTitle')}</Heading>
      <ol className="m-0 grid list-none gap-3 p-0">
        {(['one', 'two', 'three'] as const).map((key, index) => (
          <li key={key} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-ui text-ink-2">
            <span aria-hidden="true" className="font-mono text-meta text-ink">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{t(`aside.rule.${key}`)}</span>
          </li>
        ))}
      </ol>
      <Link href="/communaute/regles" className="justify-self-start text-ui font-medium text-accent-text underline underline-offset-2">
        {t('aside.rulesLink')}
      </Link>
    </Card>
  );
}

/**
 * Colonne latérale du fil (bureau ; sous le fil en mobile) : mon profil ou son activation, les
 * règles en bref, les pages personnelles (blocages, décisions) et, pour l'équipe, la modération.
 */
export default function CommunityAside({ className }: { className?: string }) {
  const t = useTranslations('community');
  const { me, token, isGuest } = useCommunity();
  const operator = useIsOperator(token);
  const profile = me.profile;

  const links = [
    { href: '/communaute/profil', label: t('aside.myProfile') },
    { href: '/communaute/blocages', label: t('aside.blocks') },
    { href: '/communaute/decisions', label: t('aside.decisions') },
    ...(operator ? [{ href: '/communaute/moderation', label: t('aside.moderation') }] : []),
  ];

  return (
    <aside className={cx('grid content-start gap-4', className)} aria-label={t('aside.label')}>
      {profile ? (
        <Card padding="md" className="grid gap-3">
          <div className="flex items-center gap-3">
            <CommunityAvatar url={profile.avatarUrl} size={48} />
            <div className="grid min-w-0 gap-0.5">
              <p className="m-0 truncate font-display text-h4 font-semibold text-ink">@{profile.handle}</p>
              <Link href={communityProfilePath(profile.handle)} className="text-ui text-accent-text underline underline-offset-2">
                {t('aside.seePublicProfile')}
              </Link>
            </div>
          </div>
        </Card>
      ) : !isGuest ? (
        <Card padding="md" className="grid gap-3">
          <h2 className="m-0 font-display text-h4 font-semibold text-ink">{t('aside.joinTitle')}</h2>
          <p className="m-0 text-ui text-ink-2">{t('aside.joinBody')}</p>
          <Link href="/communaute/profil" className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'justify-self-start' })}>
            {t('actions.createProfile')}
          </Link>
        </Card>
      ) : null}

      <RulesDigest />

      <nav aria-label={t('aside.linksLabel')}>
        <ul className="m-0 grid list-none divide-y divide-line rounded-card border border-line bg-surface p-0">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-ui text-ink no-underline transition-colors hover:bg-sunken hover:text-accent-text"
              >
                {link.label}
                <ChevronRight size={16} aria-hidden="true" className="text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
