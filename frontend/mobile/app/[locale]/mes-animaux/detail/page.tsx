'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AnimalDetailPage from '@/app/[locale]/mes-animaux/[id]/page';
import { useQueryRouteParams } from '@/lib/platform';

function AnimalDetailFromQuery() {
  const params = useQueryRouteParams('id');
  // `key` : changer de id (même route, autre query) remonte la page au lieu de garder
  // l'état (données, formulaires) de la fiche précédente.
  const id = useSearchParams().get('id') ?? '';
  return <AnimalDetailPage key={id} params={params} />;
}

/** App mobile : /<locale>/mes-animaux/detail?id=<id> rend la fiche web /<locale>/mes-animaux/<id>. */
export default function MobileAnimalDetailPage() {
  return (
    <Suspense fallback={null}>
      <AnimalDetailFromQuery />
    </Suspense>
  );
}
