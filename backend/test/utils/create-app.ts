import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  Provider,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { CacheModule } from '../../src/cache/cache.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TestCacheModule } from '../test-cache.module';

export interface TestApp {
  app: INestApplication;
  /** URL de base (http://127.0.0.1:<port>) du serveur déjà à l'écoute. */
  url: string;
}

/**
 * Fabrique de l'application pour les tests e2e, alignée sur `src/main.ts` :
 * helmet, CORS de développement, ValidationPipe (whitelist + forbidNonWhitelisted +
 * transform) et HttpExceptionFilter global.
 *
 * Le serveur HTTP écoute sur un port éphémère (`listen(0)`) : avec un simple
 * `app.init()`, supertest ouvre un serveur éphémère PAR requête, et les rafales
 * de requêtes parallèles échouaient en ECONNRESET (BE-10). Utiliser `url` :
 *
 *   const { app, url } = await createTestApp();
 *   await request(url).get('/health').expect(200);
 *
 * Penser à `await app.close()` dans `afterAll`.
 *
 * Aucun accès réseau : `test/setup.ts` branche un transport HTTP hors-ligne (fixtures GBIF,
 * Open Pet Food Facts…) sous le client externe partagé. Pour simuler une panne, appeler
 * `setExternalHttpAdapterOverride(createFakeExternalAdapter([routePanne]))` AVANT cette fabrique.
 */
export interface TestAppExtras {
  /** Contrôleurs à monter en plus d'AppModule (ex. module non chargé sans Redis). */
  controllers?: Type<unknown>[];
  providers?: Provider[];
}

export async function createTestApp(
  extras: TestAppExtras = {},
): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extras.controllers ?? [],
    providers: extras.providers ?? [],
  })
    .overrideModule(CacheModule)
    .useModule(TestCacheModule)
    .compile();

  const app = moduleFixture.createNestApplication();

  app.use(helmet());
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  return { app, url };
}
