'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import CommunityGate, { CommunityPage } from '@/components/community/CommunityGate';
import { DecisionDetail } from '@/components/community/Decisions';
import { BackLink } from '@/components/community/primitives';

/**
 * Une décision de modération (lien de l'e-mail de notification) : exposé des motifs et recours.
 * App mobile : `/communaute/decisions?id=<id>` (même composant).
 */
export default function CommunityDecisionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('community');
  return (
    <CommunityGate>
      <CommunityPage>
        <BackLink href="/communaute/decisions">{t('decisions.backToList')}</BackLink>
        <DecisionDetail key={id} id={id} />
      </CommunityPage>
    </CommunityGate>
  );
}
