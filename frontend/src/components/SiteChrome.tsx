'use client';

import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

/** Groupes de routes qui fournissent eux-mêmes en-tête, `<main>` et pied (cf. DESIGN.md § 8.1). */
const SELF_FRAMED_GROUPS = new Set(['(marketing)']);

/**
 * Habillage transitoire du layout racine `[locale]` pendant la séparation des deux couches
 * (DESIGN.md § 8.1) : les pages du groupe `(marketing)` reçoivent leur cadre de
 * `(marketing)/layout.tsx` ; toutes les autres pages, pas encore migrées vers un groupe,
 * gardent exactement l'habillage historique (en-tête, bandeau de vérification, `<main>`, pied).
 * À supprimer quand le groupe `(app)` existera : le layout racine ne rendra plus que `children`.
 */
export function SiteChrome({
  header,
  banner,
  footer,
  children,
}: {
  header: ReactNode;
  banner: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  if (segment && SELF_FRAMED_GROUPS.has(segment)) return <>{children}</>;

  return (
    <>
      {header}
      {banner}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      {footer}
    </>
  );
}
