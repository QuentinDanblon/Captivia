import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Cible mobile (W6-02, D-11) : `MOBILE_BUILD=1` produit un export statique (`out/`) embarqué dans
 * Capacitor. À lancer via `npm run build:mobile` (scripts/build-mobile.mjs), qui écarte aussi les
 * routes serveur incompatibles. Sans cette variable, la configuration web ci-dessous est inchangée.
 */
const isMobileBuild = process.env.MOBILE_BUILD === '1';

/**
 * Origine du backend, calculée au build à partir de NEXT_PUBLIC_API_URL (la même
 * valeur est inlinée dans le bundle navigateur par src/lib/config.ts).
 */
function apiOrigin(): string | null {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!raw) return null;
  try {
    const { protocol, origin } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:' ? origin : null;
  } catch {
    return null;
  }
}

const API_ORIGIN = apiOrigin();
if (isProd && !API_ORIGIN) {
  console.warn(
    '[next.config] NEXT_PUBLIC_API_URL est absent ou invalide : la CSP (connect-src) ' +
      "n'autorisera pas le backend. Définissez-le avant `next build`.",
  );
}

/** Origine d'ingestion Sentry (DSN navigateur), autorisée en connect-src seulement si un DSN est défini. */
function sentryOrigin(): string | null {
  const dsn = (process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim();
  if (!dsn) return null;
  try {
    const { protocol, origin } = new URL(dsn);
    return protocol === 'https:' ? origin : null;
  } catch {
    return null;
  }
}

const SENTRY_ORIGIN = sentryOrigin();

const connectSrc = [
  "'self'",
  ...(API_ORIGIN ? [API_ORIGIN] : []),
  ...(SENTRY_ORIGIN ? [SENTRY_ORIGIN] : []),
  // Backend local / LAN (développement uniquement, jamais en production).
  ...(isProd ? [] : ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://*:3001']),
].join(' ');

const webConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  // Aucun composant next/image n'est utilisé : on évite l'optimiseur (sharp, remotePatterns).
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // 'unsafe-inline' est requis par Next pour les styles inline et les
            // scripts de preload en production. À durcir (nonces) en P2.
            // connect-src : 'self' + origine de NEXT_PUBLIC_API_URL (calculée au build) ;
            // localhost:3001 n'est ajouté qu'en développement.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              `connect-src ${connectSrc}`,
              "object-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

/**
 * Export statique pour Capacitor : pas de serveur, donc ni headers() (la CSP est injectée en
 * <meta> par scripts/build-mobile.mjs), ni rewrites, ni middleware. Voir docs/MOBILE.md.
 */
const mobileConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactCompiler: true,
  images: { unoptimized: true },
  // Inliné dans le bundle : i18n/routing.ts passe en `localePrefix: 'always'`, src/lib/platform.ts
  // expose IS_MOBILE_BUILD.
  env: { NEXT_PUBLIC_MOBILE_BUILD: '1' },
};

const nextConfig: NextConfig = isMobileBuild ? mobileConfig : webConfig;

export default withNextIntl(nextConfig);
