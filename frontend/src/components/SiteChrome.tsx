'use client';

import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';

/** Groupe de routes de l'application : il porte sa propre coquille (`AppShell`, cf. `(app)/layout.tsx`). */
export const APP_ROUTE_GROUP = '(app)';

export interface SiteChromeProps {
  /** En-tête marketing et bandeaux (rendus côté serveur par le layout racine). */
  header: ReactNode;
  /** Pied de page marketing (composant serveur). */
  footer: ReactNode;
  children: ReactNode;
}

/**
 * Habillage des pages hors application (landing, pages légales, connexion…) : en-tête marketing,
 * `<main>` et pied de page, reçus du layout racine (composants serveur passés en props).
 *
 * Les pages du groupe `(app)` reçoivent leurs enfants tels quels : `AppShell` rend lui-même
 * `<main id="main-content">`, le rail et la barre d'onglets (un seul `<main>`, aucun en-tête doublé).
 * Le test porte sur le segment du groupe, pas sur une liste d'URL : déplacer une page dans `(app)`
 * suffit à lui donner la coquille de l'app.
 *
 * Transitoire (DESIGN.md § 8.1, point 3) : quand le groupe `(marketing)` porte son propre
 * habillage, ce composant disparaît et le layout racine ne garde que `<html>`, les polices, les
 * fournisseurs et `ErrorBoundary`.
 */
export function SiteChrome({ header, footer, children }: SiteChromeProps) {
  const segment = useSelectedLayoutSegment();
  if (segment === APP_ROUTE_GROUP) return <>{children}</>;

  return (
    <>
      {header}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        {children}
      </main>
      {footer}
    </>
  );
}

export default SiteChrome;
