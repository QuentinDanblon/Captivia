// Sentry doit être initialisé avant tout autre import (instrumentation) : ne pas déplacer.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './prisma/prisma.service';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { resolveTrustProxy } from './config/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Les logs émis avant l'init sont mis en tampon puis rejoués par pino (nestjs-pino).
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
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

  // Filtre global : journalise et remonte à Sentry (si initialisé) les erreurs >= 500.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Déclenche les hooks de cycle de vie Nest (onModuleDestroy…) à l'arrêt
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = process.env.PORT || 3001;
  // Défaut '0.0.0.0' (IPv4) : fonctionne partout, y compris les conteneurs sans IPv6
  // (où '::' fait planter le listen). Pour du dual-stack en dev local (localhost -> ::1),
  // définir HOST=::.
  const host = process.env.HOST || '0.0.0.0';
  const cacheTtl = parseInt(
    configService.get<string>('CACHE_TTL') || '3600',
    10,
  );

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
