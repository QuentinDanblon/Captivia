import type { ReactNode } from 'react';

/**
 * Overlay mobile, copié dans src/app par scripts/build-mobile.mjs le temps du build (jamais présent
 * dans le build web). `output: 'export'` exige generateStaticParams sur toute route dynamique : on
 * n'exporte qu'un paramètre factice. L'app ouvre les fiches via /mes-animaux/detail?id=… (docs/MOBILE.md).
 */
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function MobileAnimalIdLayout({ children }: { children: ReactNode }) {
  return children;
}
