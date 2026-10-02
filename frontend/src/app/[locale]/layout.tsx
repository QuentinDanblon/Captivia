import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '../../../i18n/routing';
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

export const metadata: Metadata = {
  title: 'Captivia – Le guide de la faune',
  description:
    'Plateforme complète, pédagogique et bienveillante qui accompagne les propriétaires d\'animaux domestiques et NAC au quotidien',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col w-screen`}
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
