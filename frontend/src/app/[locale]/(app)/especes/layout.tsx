import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/** Recherche d'espèces de l'app : publique et indexable (point d'entrée vers les fiches). */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata({
    locale,
    path: '/especes',
    titleKey: 'speciesSearchTitle',
    descriptionKey: 'speciesSearchDescription',
  });
}

export default function SpeciesSearchLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
