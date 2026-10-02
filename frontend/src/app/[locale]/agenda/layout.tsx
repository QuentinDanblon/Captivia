import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata({
    locale,
    path: '/agenda',
    titleKey: 'agendaTitle',
    noindex: true,
  });
}

export default function AgendaLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
