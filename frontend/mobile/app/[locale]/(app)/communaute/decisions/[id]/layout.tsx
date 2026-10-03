import type { ReactNode } from 'react';

/**
 * Overlay mobile, copié dans src/app par scripts/build-mobile.mjs le temps du build (jamais présent
 * dans le build web) : paramètre factice exigé par `output: 'export'`. L'app ouvre ces pages via
 * /communaute/decisions?id=… (la page liste y lit le paramètre) (src/lib/platform.ts, docs/MOBILE.md).
 */
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function MobileCommunityDecisionIdLayout({ children }: { children: ReactNode }) {
  return children;
}
