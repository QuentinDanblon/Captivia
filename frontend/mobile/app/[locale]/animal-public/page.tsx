'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PublicAnimalPage from '@/app/[locale]/animal-public/[slug]/page';
import { useQueryRouteParams } from '@/lib/platform';

function PublicAnimalFromQuery() {
  const params = useQueryRouteParams('slug');
  // `key` : changer de slug (même route, autre query) remonte la page au lieu de garder
  // l'état (données, formulaires) de la fiche précédente.
  const slug = useSearchParams().get('slug') ?? '';
  return <PublicAnimalPage key={slug} params={params} />;
}

/** App mobile : /<locale>/animal-public?slug=<slug> rend la page publique /<locale>/animal-public/<slug>. */
export default function MobilePublicAnimalPage() {
  return (
    <Suspense fallback={null}>
      <PublicAnimalFromQuery />
    </Suspense>
  );
}
