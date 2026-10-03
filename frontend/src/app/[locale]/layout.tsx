import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '../../../i18n/routing';
import { buildPageMetadata, getSiteUrl, SITE_NAME } from '@/lib/seo';
import { AuthProvider } from '@/contexts/AuthContext';
import { NativeWelcome } from '@/components/guest/NativeWelcome';
import { NativeBridge } from '@/components/native/NativeBridge';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import '../globals.css';

/*
 * Préchargement limité au sous-ensemble `latin` (fr, en, es, de, it, pt, œ et € compris) :
 * les autres sous-ensembles (latin-ext…) restent déclarés par unicode-range et ne sont
 * téléchargés qu'en cas de besoin — 256 Ko de moins à précharger sur mobile.
 *
 * Polices auto-hébergées au build par next/font (aucune requête vers Google à l'exécution :
 * compatible avec l'export statique mobile et la CSP `font-src 'self'`). Voir docs/DESIGN.md.
 *  - Fraunces : titres et noms latins (variable : opsz automatique, SOFT réglé en CSS).
 *  - IBM Plex Sans : interface et texte courant (variable, graisses 400-600 utilisées).
 *  - IBM Plex Mono : mesures, doses, dates, n° de puce (chiffres tabulaires).
 */
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
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
  // Couleur de la barre du navigateur = papier de l'en-tête (clair / sombre).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#121714' },
  ],
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
  // Les textes de la landing sont rendus côté serveur : seuls `landing.search` (composant client
  // de recherche) et `landing.photos` (textes alternatifs de `CommonsPhoto`, écrans de compte et
  // essai) sont transmis au navigateur, pour ne pas alourdir chaque page de ~11 Ko.
  const { landing, ...shared } = await getMessages({ locale });
  const landingMessages = landing as Record<string, unknown> | undefined;
  const messages = { ...shared, landing: { search: landingMessages?.search, photos: landingMessages?.photos } };

  return (
    <html lang={locale} className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen flex flex-col w-full bg-paper text-ink font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {/* Aucun cadre ici : chaque groupe de routes apporte le sien — (app) AppShell, (marketing)
                MarketingFrame, (auth) AccountFrame — ; error.tsx et not-found.tsx portent MarketingFrame. */}
            <ErrorBoundary>{children}</ErrorBoundary>
            {/* App mobile : premier lancement sans session → essai sans compte proposé. */}
            <NativeWelcome />
            {/* App mobile : liens universels, rappels locaux, bouton retour Android (rien sur le web). */}
            <NativeBridge />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
