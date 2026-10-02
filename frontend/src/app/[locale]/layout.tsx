import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '../../../i18n/routing';
import { buildPageMetadata, getSiteUrl, SITE_NAME } from '@/lib/seo';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { SiteFooter } from '@/components/SiteFooter';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import '../globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

/**
 * Métadonnées par défaut (= accueil) traduites. Les segments publics les affinent via leur propre
 * `generateMetadata` (titre + canonical + hreflang) ; le template ajoute « · Captivia » aux titres.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  const base = buildPageMetadata({ locale, path: '', description: t('description') });

  return {
    ...base,
    metadataBase: new URL(getSiteUrl()),
    title: { default: t('defaultTitle'), template: `%s · ${SITE_NAME}` },
    applicationName: SITE_NAME,
    openGraph: { ...base.openGraph, title: t('defaultTitle') },
    twitter: { ...base.twitter, title: t('defaultTitle') },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0aa678',
  viewportFit: 'cover',
};

/** Pré-rend une version par locale ; toute autre valeur (ex. /robots.txt) tombe sur notFound(). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} className="scroll-smooth">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col w-full`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <AppHeader />
            <main id="main-content" tabIndex={-1} className="flex-1 w-full">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
            <SiteFooter />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
