'use client';

import { Suspense } from 'react';
import SpeciesDetailPage from '@/app/[locale]/species/[id]/page';
import { useQueryRouteParams } from '@/lib/platform';

function SpeciesFromQuery() {
  const params = useQueryRouteParams('id');
  return <SpeciesDetailPage params={params} />;
}

/** App mobile : /<locale>/species?id=<id> rend la fiche web /<locale>/species/<id>. */
export default function MobileSpeciesPage() {
  return (
    <Suspense fallback={null}>
      <SpeciesFromQuery />
    </Suspense>
  );
}
