import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Page de partage privée par lien : jamais indexée (W0-06).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AnimalPublicLayout({ children }: { children: ReactNode }) {
  return children;
}
