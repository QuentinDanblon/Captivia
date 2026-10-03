'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SectionHeader } from '@/components/ui';
import CommunityGate, { CommunityPage } from '@/components/community/CommunityGate';
import { DecisionDetail, DecisionList, MyReports } from '@/components/community/Decisions';
import { BackLink } from '@/components/community/primitives';

function DecisionsView() {
  const t = useTranslations('community');
  // App mobile (export statique) : le détail s'ouvre ici, `?id=<décision>` (src/lib/platform.ts).
  const id = useSearchParams().get('id');
  if (id) {
    return (
      <CommunityPage>
        <BackLink href="/communaute/decisions">{t('decisions.backToList')}</BackLink>
        <DecisionDetail key={id} id={id} />
      </CommunityPage>
    );
  }
  return (
    <CommunityPage narrow>
      <BackLink href="/communaute/profil">{t('profile.back')}</BackLink>
      <SectionHeader title={t('decisions.title')} description={t('decisions.lead')} />
      <DecisionList />
      <MyReports />
    </CommunityPage>
  );
}

/** Décisions de modération me concernant, et mes signalements. */
export default function CommunityDecisionsPage() {
  return (
    <CommunityGate>
      <Suspense fallback={null}>
        <DecisionsView />
      </Suspense>
    </CommunityGate>
  );
}
