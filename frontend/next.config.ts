import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { apiOrigin, securityHeaders } from './src/lib/csp';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Cible mobile (W6-02, D-11) : `MOBILE_BUILD=1` produit un export statique (`out/`) embarqué dans
 * Capacitor. À lancer via `npm run build:mobile` (scripts/build-mobile.mjs), qui écarte aussi les
 * routes serveur incompatibles. Sans cette variable, la configuration web ci-dessous est inchangée.
 */
const isMobileBuild = process.env.MOBILE_BUILD === '1';

/** URL du backend, lue au build (la même valeur est inlinée dans le bundle par src/lib/config.ts). */
const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (isProd && !apiOrigin(API_URL)) {
  console.warn(
    '[next.config] NEXT_PUBLIC_API_URL est absent ou invalide : la CSP (connect-src) ' +
      "n'autorisera pas le backend. Définissez-le avant `next build`.",
  );
}

/**
 * En-têtes de sécurité et CSP (W4-08), construits par le module pur src/lib/csp.ts (testé) :
 * pas de nonce (les pages restent statiques, cf. docs/DEPLOY.md § Sécurité), pas de
 * 'unsafe-eval' en production, connect-src limité à l'API et à Sentry (NEXT_PUBLIC_SENTRY_DSN).
 */
const SECURITY_HEADERS = securityHeaders({
  dev: !isProd,
  apiUrl: API_URL,
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Images de la communauté (bucket R2 public) ; absent : servies par l'API (pilote local).
  mediaBaseUrl: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
});

/**
 * Racine du projet : le dépôt contient plusieurs package-lock.json (racine, frontend/, backend/)
 * sans workspaces. On la fixe au lieu de la laisser deviner (avertissement au build), ce qui
 * place aussi server.js à la racine de .next/standalone, comme l'attend le Dockerfile.
 */
const PROJECT_ROOT = path.resolve(__dirname);

const webConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: PROJECT_ROOT },
  outputFileTracingRoot: PROJECT_ROOT,
  reactCompiler: true,
  // Aucun composant next/image n'est utilisé : on évite l'optimiseur (sharp, remotePatterns).
  images: { unoptimized: true },
  /**
   * Notifications de modération (backend, `decisionUrl`) : liens `/community/decisions/<id>`, sans
   * locale. La page vit sous `/communaute/decisions/<id>` : redirection permanente, locale gardée.
   */
  async redirects() {
    return [
      { source: '/community/decisions/:id', destination: '/communaute/decisions/:id', permanent: true },
      {
        source: '/:locale(en|es|de|it|pt)/community/decisions/:id',
        destination: '/:locale/communaute/decisions/:id',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
      {
        // Service worker Web Push (W3-03) : toujours revalidé pour qu'une mise à jour soit
        // détectée sans attendre l'expiration d'un cache.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

/**
 * Export statique pour Capacitor : pas de serveur, donc ni headers() (la CSP, avec les hachages
 * des scripts inline de chaque page, est injectée en <meta> par scripts/build-mobile.mjs), ni
 * rewrites, ni middleware. Voir docs/MOBILE.md.
 */
const mobileConfig: NextConfig = {
  output: 'export',
  turbopack: { root: PROJECT_ROOT },
  outputFileTracingRoot: PROJECT_ROOT,
  trailingSlash: true,
  reactCompiler: true,
  images: { unoptimized: true },
  // Inliné dans le bundle : i18n/routing.ts passe en `localePrefix: 'always'`, src/lib/platform.ts
  // expose IS_MOBILE_BUILD.
  env: { NEXT_PUBLIC_MOBILE_BUILD: '1' },
};

const nextConfig: NextConfig = isMobileBuild ? mobileConfig : webConfig;

export default withNextIntl(nextConfig);
