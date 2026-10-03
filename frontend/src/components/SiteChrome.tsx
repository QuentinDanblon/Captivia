'use client';

import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';

/** Groupe de routes de l'application : il porte sa propre coquille (`AppShell`, cf. `(app)/layout.tsx`). */
export const APP_ROUTE_GROUP = '(app)';
/** Groupe de la vitrine : en-tête, `<main>` et pied fournis par `(marketing)/layout.tsx`. */
export const MARKETING_ROUTE_GROUP = '(marketing)';
const SELF_FRAMED_GROUPS = new Set([APP_ROUTE_GROUP, MARKETING_ROUTE_GROUP]);

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
 * Les pages du groupe `(marketing)` (landing, pages légales) reçoivent de même leur cadre de
 * `(marketing)/layout.tsx`.
 *
 * Transitoire (DESIGN.md § 10.5, « Reste à faire ») : quand les dernières pages hors groupe (connexion,
 * inscription…) auront rejoint un groupe, ce composant disparaît et le layout racine ne garde que `<html>`, les polices, les
 * fournisseurs et `ErrorBoundary`.
 */
export function SiteChrome({ header, footer, children }: SiteChromeProps) {
  const segment = useSelectedLayoutSegment();
  if (segment && SELF_FRAMED_GROUPS.has(segment)) return <>{children}</>;

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
