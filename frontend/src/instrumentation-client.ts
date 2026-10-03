/**
 * Observabilité Sentry côté navigateur (convention Next.js : instrumentation-client.ts,
 * exécuté avant l'hydratation). Sans NEXT_PUBLIC_SENTRY_DSN : aucun chargement, aucun appel réseau.
 * Le SDK est importé dynamiquement pour ne rien ajouter au bundle initial quand il est désactivé.
 */
import { scrubSentryEvent } from './lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== 'undefined') {
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        // Données personnelles : rien n'est joint automatiquement (IP, cookies, en-têtes).
        sendDefaultPii: false,
        // Le lien de reset (?token=…) ne doit jamais atteindre Sentry (URL, transaction, breadcrumbs).
        beforeSend: (event) => scrubSentryEvent(event),
        beforeSendTransaction: (event) => scrubSentryEvent(event),
        beforeBreadcrumb: (breadcrumb) => scrubSentryEvent(breadcrumb),
      });
    })
    .catch(() => {
      // Observabilité best-effort : ne jamais bloquer l'application.
    });
}
