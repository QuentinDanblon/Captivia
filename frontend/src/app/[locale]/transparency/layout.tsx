import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '../../../../i18n/routing';
import { buildPageMetadata } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

// Titre/description : ceux de la page ; ce layout ajoute canonical, hreflang et OpenGraph.
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'transparency' });
  return buildPageMetadata({
    locale,
    path: '/transparency',
    title: t('title'),
    description: t('metaDescription'),
  });
}

export default function TransparencyLayout({ children }: Pick<Props, 'children'>) {
  return children;
}
