import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { MarketingFrame } from '@/components/frames/MarketingFrame';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/**
 * Couche marketing (DESIGN.md § 6.1) : landing, pages légales, page publique d'un animal. En-tête
 * et pied du site, contenu dans `<main id="main-content">` (cible du lien d'évitement de l'en-tête).
 * Les pages de l'app et des écrans de compte ont leur propre cadre.
 */
export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params;
  // Locale fixée pour ce segment : le pied (Server Component) se traduit sans lire les en-têtes,
  // et les pages restent pré-rendues au build.
  setRequestLocale(locale);

  return (
    <MarketingFrame>
      <ErrorBoundary>{children}</ErrorBoundary>
    </MarketingFrame>
  );
}
