'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SpeciesDetailPage from '@/app/[locale]/species/[id]/page';
import { useQueryRouteParams } from '@/lib/platform';

function SpeciesFromQuery() {
  const params = useQueryRouteParams('id');
  // `key` : changer de id (même route, autre query) remonte la page au lieu de garder
  // l'état (données, formulaires) de la fiche précédente.
  const id = useSearchParams().get('id') ?? '';
  return <SpeciesDetailPage key={id} params={params} />;
}

/** App mobile : /<locale>/species?id=<id> rend la fiche web /<locale>/species/<id>. */
export default function MobileSpeciesPage() {
  return (
    <Suspense fallback={null}>
      <SpeciesFromQuery />
    </Suspense>
  );
}
