'use client';

import { Suspense } from 'react';
import AnimalDetailPage from '@/app/[locale]/mes-animaux/[id]/page';
import { useQueryRouteParams } from '@/lib/platform';

function AnimalDetailFromQuery() {
  const params = useQueryRouteParams('id');
  return <AnimalDetailPage params={params} />;
}

/** App mobile : /<locale>/mes-animaux/detail?id=<id> rend la fiche web /<locale>/mes-animaux/<id>. */
export default function MobileAnimalDetailPage() {
  return (
    <Suspense fallback={null}>
      <AnimalDetailFromQuery />
    </Suspense>
  );
}
