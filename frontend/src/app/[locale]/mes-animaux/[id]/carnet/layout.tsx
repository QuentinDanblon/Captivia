import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string; id: string }> };

/** Page privée (données de santé) : jamais indexée. */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale, id } = await params;
  return seoPageMetadata({
    locale,
    path: `/mes-animaux/${id}/carnet`,
    titleKey: 'carnetTitle',
    noindex: true,
  });
}

export default function CarnetLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
