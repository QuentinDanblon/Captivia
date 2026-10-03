import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata({
    locale,
    path: '/register',
    titleKey: 'registerTitle',
    noindex: true,
  });
}

export default function RegisterLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
