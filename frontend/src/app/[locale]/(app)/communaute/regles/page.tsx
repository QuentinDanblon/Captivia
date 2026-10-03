'use client';

import { useTranslations } from 'next-intl';
import { Card, SectionHeader } from '@/components/ui';
import { CommunityPage } from '@/components/community/CommunityGate';
import { BackLink } from '@/components/community/primitives';
import { COMMUNITY_RULES_TEXT_VERSION } from '@/lib/community';

const RULES = ['kind', 'animals', 'health', 'trade', 'privacy', 'spam', 'honest'] as const;
const PROCESS = ['report', 'decision', 'appeal'] as const;

/**
 * Règles de la communauté, versionnées (`COMMUNITY_RULES_TEXT_VERSION`) : lisibles sans compte, avant
 * l'activation du profil. Une nouvelle version doit être acceptée pour continuer à publier.
 */
export default function CommunityRulesPage() {
  const t = useTranslations('community');
  return (
    <CommunityPage narrow>
      <BackLink href="/communaute">{t('post.backToFeed')}</BackLink>
      <SectionHeader
        title={t('rules.title')}
        marginNote={COMMUNITY_RULES_TEXT_VERSION}
        marginLabel={t('rules.versionLabel')}
        description={t('rules.lead')}
      />
      <ol className="m-0 grid list-none gap-5 p-0">
        {RULES.map((key, index) => (
          <li key={key} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
            <span aria-hidden="true" className="pt-1 font-mono text-meta text-ink-2">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="grid gap-1">
              <h2 className="m-0 font-display text-h4 font-semibold text-ink">{t(`rules.items.${key}.title`)}</h2>
              <p className="m-0 max-w-prose text-body text-ink-2">{t(`rules.items.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <Card as="section" tone="sunken" title={t('rules.processTitle')} titleId="moderation">
        <ol className="m-0 grid gap-3 pl-5 text-body text-ink-2">
          {PROCESS.map((key) => (
            <li key={key}>{t(`rules.process.${key}`)}</li>
          ))}
        </ol>
      </Card>
    </CommunityPage>
  );
}
