// À importer EN PREMIER dans main.ts : Sentry doit être initialisé avant tout autre module
// pour instrumenter http, express, etc. Sans SENTRY_DSN : aucun effet (pas d'init, pas de réseau).
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import { getRelease } from './config/release';
import { buildSentryOptions, tracesRateFromEnv } from './sentry-scrub';

// Nettoyage (jetons, mots de passe, codes) des erreurs, transactions, spans et fils d'Ariane,
// et exclusion du flux iCalendar de l'échantillonnage : voir sentry-scrub.ts.
export { scrubEvent } from './sentry-scrub';

if (process.env.SENTRY_DSN) {
  Sentry.init(
    buildSentryOptions({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: getRelease(),
      tracesSampleRate: tracesRateFromEnv(
        process.env.SENTRY_TRACES_SAMPLE_RATE,
      ),
    }),
  );
}
