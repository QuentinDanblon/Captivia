'use client';

import { useParams } from 'next/navigation';
import CarnetPrintView from './CarnetPrintView';

/** Web : /<locale>/mes-animaux/<id>/carnet. App mobile : voir mobile/app/[locale]/(app)/mes-animaux/carnet. */
export default function CarnetPrintPage() {
  const { id } = useParams<{ id: string }>();
  return <CarnetPrintView id={id} />;
}
