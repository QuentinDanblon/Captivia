import * as Sentry from '@sentry/nextjs';

/**
 * Observabilité Sentry côté serveur (convention Next.js : src/instrumentation.ts).
 * Initialisé UNIQUEMENT si un DSN est présent (NEXT_PUBLIC_SENTRY_DSN ou SENTRY_DSN).
 * Sans DSN : aucun impact (retour immédiat, pas d'appel réseau).
 *
 * Côté navigateur : voir src/instrumentation-client.ts. `withSentryConfig`
 * (tunnel, sourcemaps) n'est pas branché dans next.config.ts : voir W1-03.
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

/** Remonte à Sentry les erreurs de rendu serveur (Server Components, route handlers, proxy). */
export const onRequestError = Sentry.captureRequestError;
