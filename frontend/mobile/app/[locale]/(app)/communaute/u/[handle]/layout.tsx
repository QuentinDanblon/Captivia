import type { ReactNode } from 'react';

/**
 * Overlay mobile, copié dans src/app par scripts/build-mobile.mjs le temps du build (jamais présent
 * dans le build web) : paramètre factice exigé par `output: 'export'`. L'app ouvre ces pages via
 * /communaute/u?handle=… (src/lib/platform.ts, docs/MOBILE.md).
 */
export function generateStaticParams() {
  return [{ handle: '_' }];
}

export default function MobileCommunityMemberHandleLayout({ children }: { children: ReactNode }) {
  return children;
}
