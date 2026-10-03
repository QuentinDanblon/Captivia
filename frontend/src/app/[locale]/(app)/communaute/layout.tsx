import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/** Communauté : réservée aux comptes connectés, jamais indexée. */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata({
    locale,
    path: '/communaute',
    titleKey: 'communityTitle',
    noindex: true,
  });
}

export default function CommunityLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
