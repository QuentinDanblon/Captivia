import type { ReactNode } from 'react';

/** Overlay mobile : paramètre factice exigé par l'export ; l'app utilise /animal-public?slug=… (docs/MOBILE.md). */
export function generateStaticParams() {
  return [{ slug: '_' }];
}

export default function MobilePublicAnimalSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
