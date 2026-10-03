import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { MarketingHeader } from '@/components/AppHeader';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { MarketingFooter } from '@/components/SiteFooter';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/**
 * Couche marketing (DESIGN.md § 8.1) : landing et pages légales. En-tête et pied du site,
 * contenu dans `<main id="main-content">` (cible du lien d'évitement de l'en-tête).
 * Les pages de l'app n'utilisent pas ce cadre.
 */
export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params;
  // Locale fixée pour ce segment : le pied (Server Component) se traduit sans lire les en-têtes,
  // et les pages restent pré-rendues au build.
  setRequestLocale(locale);

  return (
    <>
      <MarketingHeader />
      <EmailVerificationBanner />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <MarketingFooter />
    </>
  );
}
