import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';
import { buildPageMetadata, getSiteUrl, localizedPath, SITE_NAME } from '@/lib/seo';
import { Faq, FinalCta, Gallery, Hero, HowItWorks, Offer, SearchSection, Tour, Trust } from '@/components/landing/LandingSections';

type Props = { params: Promise<{ locale: string }> };

/** Accueil : titre complet (sans le suffixe du template), description, carte sociale grand format. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  const base = buildPageMetadata({ locale, path: '', description: t('description') });
  return {
    ...base,
    title: { absolute: t('title') },
    openGraph: { ...base.openGraph, title: t('title') },
    twitter: { ...base.twitter, card: 'summary_large_image', title: t('title') },
  };
}

/** Données structurées : l'application, son offre gratuite et ses langues. */
function SoftwareApplicationJsonLd({ locale, description, offer }: { locale: string; description: string; offer: string }) {
  const url = `${getSiteUrl()}${localizedPath(locale, '')}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url,
    description,
    inLanguage: locale,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, Android, iOS',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', description: offer },
  };
  return (
    <script
      type="application/ld+json"
      // JSON sérialisé côté serveur, sans donnée utilisateur ; « < » échappé par précaution.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <>
      <SoftwareApplicationJsonLd locale={locale} description={t('meta.description')} offer={t('hero.reassurance')} />
      <Hero locale={locale} />
      <Tour locale={locale} />
      <Gallery locale={locale} />
      <HowItWorks locale={locale} />
      <Offer locale={locale} />
      <Trust locale={locale} />
      <SearchSection locale={locale} />
      <Faq locale={locale} />
      <FinalCta locale={locale} />
    </>
  );
}
