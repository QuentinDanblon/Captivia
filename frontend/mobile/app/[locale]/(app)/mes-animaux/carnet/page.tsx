'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CarnetPrintView from '@/app/[locale]/(app)/mes-animaux/[id]/carnet/CarnetPrintView';

function CarnetFromQuery() {
  const id = useSearchParams().get('id') ?? '';
  return <CarnetPrintView key={id} id={id} />;
}

/** App mobile : /<locale>/mes-animaux/carnet?id=<id> rend le carnet web /<locale>/mes-animaux/<id>/carnet. */
export default function MobileCarnetPage() {
  return (
    <Suspense fallback={null}>
      <CarnetFromQuery />
    </Suspense>
  );
}
