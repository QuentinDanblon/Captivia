'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';

/**
 * Couche « application » (DESIGN.md § 6.1) : mes animaux, agenda, paramètres, magasin.
 * `AppShell` rend le rail (bureau), la barre d'onglets (mobile) et le `<main>` ; le bandeau de
 * vérification d'e-mail se place en tête du contenu, sous la barre haute.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <EmailVerificationBanner />
      {children}
    </AppShell>
  );
}
