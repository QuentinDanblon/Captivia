import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  ArgumentsHost,
  BadRequestException,
  ExceptionFilter,
  HttpException,
  Logger,
  LogLevel,
  ValidationPipe,
} from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { resolveTrustProxy } from './config/trust-proxy';

/**
 * Niveaux de log actifs selon LOG_LEVEL (debug|log|warn|error, défaut : log).
 * 'info' est accepté comme alias de 'log' (valeur historique de .env.example).
 * Le filtrage est appliqué globalement via `logger: logLevels` dans NestFactory.create
 * (mécanisme officiel Nest : les LogLevel[] deviennent les niveaux statiques du Logger).
 */
const DEFAULT_LOG_LEVEL = 'log';
const LOG_LEVELS: Record<string, LogLevel[]> = {
  error: ['error', 'fatal'],
  warn: ['warn', 'error', 'fatal'],
  log: ['log', 'warn', 'error', 'fatal'],
  debug: ['debug', 'log', 'warn', 'error', 'fatal'],
  verbose: ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'],
};

function resolveLogLevels(): LogLevel[] {
  const raw = (process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL).toLowerCase();
  return LOG_LEVELS[raw] ?? LOG_LEVELS[DEFAULT_LOG_LEVEL];
}

// ══════════════════════════════════════════════════════════════════════════
// Sentry (observabilité) — activé UNIQUEMENT si SENTRY_DSN est défini.
// Sans DSN : aucun impact (pas d'init, pas d'appel réseau, aucun handler).
// NB : @sentry/nestjs v10 propose SentryModule.forRoot()/SentryGlobalFilter
// (via app.module.ts) et le décorateur @SentryExceptionCaptured() (via le
// filtre existant) — les deux fichiers étant hors périmètre ici, on branche
// l'équivalent minimal dans main.ts : init + filtre local qui capture les
// exceptions inattendues puis délègue au HttpExceptionFilter (format de
// réponse API inchangé) + handlers process pour les erreurs non gérées.
// ══════════════════════════════════════════════════════════════════════════
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });

  // Filet de sécurité : capture les rejets/erreurs qui échappent au filtre HTTP
  // global (tâches de fond, timers, promesses orphelines…).
  process.on('unhandledRejection', (reason) => {
    Sentry.captureException(
      reason instanceof Error ? reason : new Error(`Unhandled rejection: ${String(reason)}`),
    );
  });
  process.on('uncaughtException', (err) => {
    Sentry.captureException(err);
    // État du process indéterminé → on flushe l'événement puis on sort
    // (même comportement crash que le défaut ; redémarrage par l'orchestrateur).
    void Sentry.flush(2000).then(
      () => process.exit(1),
      () => process.exit(1),
    );
  });
}

/**
 * Filtre global Sentry : remonte à Sentry les exceptions inattendues (non-HTTP),
 * puis délègue au HttpExceptionFilter existant (format de réponse inchangé).
 * Comme le SentryGlobalFilter officiel, les HttpException (4xx/5xx « attendues »)
 * ne sont pas reportées à Sentry.
 */
class SentryCaptureFilter implements ExceptionFilter {
  constructor(private readonly inner: ExceptionFilter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException)) {
      Sentry.captureException(exception, { mechanism: { handled: false } });
    }
    this.inner.catch(exception, host);
  }
}

async function bootstrap() {
  const logLevels = resolveLogLevels();
  // LOG_FORMAT=json : le format JSON structuré n'est pas encore branché — il faudra
  // un vrai logger (ex. pino) en P2 pour émettre du JSON. Pour l'instant le format
  // console par défaut est conservé ; seul LOG_LEVEL est effectif au bootstrap.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Filtre les logs au niveau global selon LOG_LEVEL (array = mécanisme officiel Nest).
    logger: logLevels,
  });
  const logger = new Logger('Bootstrap');

  // Trust proxy: à activer UNIQUEMENT derrière un reverse proxy de confiance (nginx, traefik…).
  // Avec 'trust proxy' actif, Express extrait la vraie IP client depuis X-Forwarded-For
  // (entrée ajoutée par le proxy, non spoofable). Sans proxy, request.ip = adresse socket.
  // TRUST_PROXY : 'true' (= 1 saut), un entier N (nombre de proxies de confiance devant l'app),
  // ou absent/'false' (désactivé).
  app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY));

  // Headers de sécurité (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy…)
  app.use(helmet());
  app.disable('x-powered-by');

  // CORS strict : origines explicites (liste séparée par des virgules dans CORS_ORIGIN).
  // En dev, si CORS_ORIGIN est absent : origines locales par défaut (jamais '*' avec credentials).
  const rawOrigins = process.env.CORS_ORIGIN;
  let corsOrigins: string[];
  if (rawOrigins && rawOrigins.trim()) {
    corsOrigins = rawOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  } else {
    corsOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
    logger.warn(
      `[CORS] CORS_ORIGIN non défini — utilisation des origines de développement : ${corsOrigins.join(', ')}`,
    );
  }
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // Auth par header Bearer (pas de cookies) : credentials inutiles et interdit avec origin '*'.
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((error) => Object.values(error.constraints || {}).join(', '))
          .join('; ');
        return new BadRequestException(`Validation failed: ${messages}`);
      },
    }),
  );

  // Filtre global : avec SENTRY_DSN, SentryCaptureFilter capture les exceptions
  // inattendues puis délègue au HttpExceptionFilter (réponses API inchangées).
  const httpExceptionFilter = new HttpExceptionFilter();
  app.useGlobalFilters(SENTRY_DSN ? new SentryCaptureFilter(httpExceptionFilter) : httpExceptionFilter);

  // Déclenche les hooks de cycle de vie Nest (onModuleDestroy…) à l'arrêt
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = process.env.PORT || 3001;
  // Défaut '0.0.0.0' (IPv4) : fonctionne partout, y compris les conteneurs sans IPv6
  // (où '::' fait planter le listen). Pour du dual-stack en dev local (localhost -> ::1),
  // définir HOST=::.
  const host = process.env.HOST || '0.0.0.0';
  const cacheTtl = parseInt(configService.get<string>('CACHE_TTL') || '3600', 10);

  await app.listen(port, host);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Network: http://<votre-ip>:${port} (pour accès téléphone)`);
  logger.log(`Cache TTL: ${cacheTtl}s`);
  logger.log(`CORS enabled for: ${corsOrigins.join(', ')}`);

  // Arrêt gracieux : ferme le serveur HTTP, déconnecte Prisma, puis sort avec le code 0.
  const shutdown = async (signal: string) => {
    logger.log(`\n[Captivia] ${signal} reçu — arrêt gracieux en cours…`);
    const forceExit = setTimeout(() => {
      logger.error('[Captivia] Arrêt forcé après 10 s (app.close() bloqué)');
      process.exit(1);
    }, 10000);
    forceExit.unref();
    try {
      await app.close();
      await app.get(PrismaService, { strict: false }).$disconnect();
      logger.log('[Captivia] Arrêt propre terminé');
      process.exit(0);
    } catch (err) {
      logger.error("[Captivia] Erreur pendant l'arrêt :", err as Error);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
void bootstrap();
