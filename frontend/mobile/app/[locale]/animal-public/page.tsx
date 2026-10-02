'use client';

import { Suspense } from 'react';
import PublicAnimalPage from '@/app/[locale]/animal-public/[slug]/page';
import { useQueryRouteParams } from '@/lib/platform';

function PublicAnimalFromQuery() {
  const params = useQueryRouteParams('slug');
  return <PublicAnimalPage params={params} />;
}

/** App mobile : /<locale>/animal-public?slug=<slug> rend la page publique /<locale>/animal-public/<slug>. */
export default function MobilePublicAnimalPage() {
  return (
    <Suspense fallback={null}>
      <PublicAnimalFromQuery />
    </Suspense>
  );
}
