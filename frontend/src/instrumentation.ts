import * as Sentry from '@sentry/nextjs';

/**
 * Observabilité Sentry côté serveur (convention Next.js : src/instrumentation.ts).
 * Initialisé UNIQUEMENT si un DSN est présent (NEXT_PUBLIC_SENTRY_DSN ou SENTRY_DSN).
 * Sans DSN : aucun impact (retour immédiat, pas d'appel réseau).
 *
 * NB : le bundling côté client (@sentry/nextjs via withSentryConfig dans
 * next.config.ts) n'est PAS branché — next.config.ts est hors périmètre.
 * Seul le runtime serveur est donc couvert pour l'instant ; pour la couverture
 * navigateur, prévoir @sentry/react + <Sentry.ErrorBoundary> dans le layout.
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}
