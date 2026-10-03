'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CommunityPostPage from '@/app/[locale]/(app)/communaute/publication/[id]/page';
import { useQueryRouteParams } from '@/lib/platform';

function FromQuery() {
  const params = useQueryRouteParams('id');
  // `key` : changer de id (même route, autre query) remonte la page au lieu de garder
  // l'état (données, formulaires) de la précédente.
  const value = useSearchParams().get('id') ?? '';
  return <CommunityPostPage key={value} params={params} />;
}

/** App mobile : /<locale>/communaute/publication?id=<id> rend la publication web /<locale>/communaute/publication/<id>. */
export default function MobileCommunityPostPage() {
  return (
    <Suspense fallback={null}>
      <FromQuery />
    </Suspense>
  );
}
