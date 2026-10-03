import type { ReactNode } from 'react';

/**
 * Overlay mobile : remplace, le temps du build mobile, le layout web (métadonnées SEO chargées depuis
 * l'API, inutiles dans l'app). Paramètre factice exigé par l'export ; l'app ouvre les fiches via
 * /species?id=… (docs/MOBILE.md).
 */
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function MobileSpeciesIdLayout({ children }: { children: ReactNode }) {
  return children;
}
