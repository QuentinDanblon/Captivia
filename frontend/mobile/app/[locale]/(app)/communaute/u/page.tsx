'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CommunityMemberPage from '@/app/[locale]/(app)/communaute/u/[handle]/page';
import { useQueryRouteParams } from '@/lib/platform';

function FromQuery() {
  const params = useQueryRouteParams('handle');
  // `key` : changer de handle (même route, autre query) remonte la page au lieu de garder
  // l'état (données, formulaires) de la précédente.
  const value = useSearchParams().get('handle') ?? '';
  return <CommunityMemberPage key={value} params={params} />;
}

/** App mobile : /<locale>/communaute/u?handle=<pseudo> rend le profil web /<locale>/communaute/u/<pseudo>. */
export default function MobileCommunityMemberPage() {
  return (
    <Suspense fallback={null}>
      <FromQuery />
    </Suspense>
  );
}
