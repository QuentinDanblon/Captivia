import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { AccountFrame } from '@/components/frames/AccountFrame';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/**
 * Couche « compte » (DESIGN.md § 6.1 et § 6.6) : connexion, inscription, mot de passe oublié et
 * nouveau, vérification d'e-mail, `/sauvegarder`. Cadre sobre (`AccountFrame`) : marque, retour,
 * langue, liens légaux ; le formulaire et sa planche (`AuthFrame`) occupent la page.
 */
export default async function AuthGroupLayout({ children, params }: Props) {
  const { locale } = await params;
  // Locale fixée pour ce segment : le cadre (Server Component) se traduit sans lire les en-têtes,
  // et les pages restent pré-rendues au build.
  setRequestLocale(locale);

  return (
    <AccountFrame>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AccountFrame>
  );
}
