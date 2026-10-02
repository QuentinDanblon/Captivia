import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { legalMetadata } from '@/content/legal';
import { buildPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

// Titre/description fournis par le contenu légal ; ce layout ajoute canonical, hreflang et OpenGraph.
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = legalMetadata(locale, 'terms');
  return buildPageMetadata({
    locale,
    path: '/cgu',
    title: typeof title === 'string' ? title : undefined,
    description: typeof description === 'string' ? description : undefined,
  });
}

export default function TermsLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
