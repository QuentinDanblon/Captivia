import type { ReactNode } from 'react';
import { MarketingHeader } from '@/components/AppHeader';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { MarketingFooter } from '@/components/SiteFooter';

/**
 * Cadre de la couche marketing (DESIGN.md § 6.1) : en-tête du site, bandeau de vérification d'e-mail,
 * `<main id="main-content">` (cible du lien d'évitement de l'en-tête) et pied de page.
 *
 * Utilisé par `(marketing)/layout.tsx` (landing, pages légales, page publique d'un animal) et, parce
 * que `error.tsx` et `not-found.tsx` remplacent le layout du groupe où l'erreur survient, par ces deux
 * fichiers. Sans `'use client'` : importable depuis un composant serveur comme depuis un composant client.
 */
export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <EmailVerificationBanner />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}

export default MarketingFrame;
