// À importer EN PREMIER dans main.ts : Sentry doit être initialisé avant tout autre module
// pour instrumenter http, express, etc. Sans SENTRY_DSN : aucun effet (pas d'init, pas de réseau).
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import type { ErrorEvent } from '@sentry/nestjs';
import { getRelease } from './config/release';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

/** Retire des événements Sentry les données personnelles (e-mail, jetons, cookies). */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  if (event.request) {
    delete event.request.cookies;
    const headers = event.request.headers;
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete headers[key];
      }
    }
  }
  return event;
}

const rate = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: getRelease(),
    tracesSampleRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
