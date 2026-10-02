import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { CacheModule } from '../../src/cache/cache.module';
import { GbifService } from '../../src/external/gbif.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TestCacheModule } from '../test-cache.module';

export interface TestApp {
  app: INestApplication;
  /** URL de base (http://127.0.0.1:<port>) du serveur déjà à l'écoute. */
  url: string;
}

export interface CreateTestAppOptions {
  /**
   * Remplace GbifService par un stub hors-ligne. À utiliser dans les suites qui
   * mesurent des temps de réponse ou des rafales : sans cela, chaque détail/recherche
   * d'espèce interroge l'API GBIF réelle (latence et pannes réseau → tests instables).
   */
  offlineGbif?: boolean;
}

/** GBIF « indisponible » : réponses vides immédiates, aucun appel réseau. */
const offlineGbifStub = {
  searchSpecies: async () => ({ results: [], count: 0, offset: 0, limit: 0, endOfRecords: true }),
  getSpecies: async () => null,
  getVernacularNames: async () => ({ results: [] }),
  getIucn: async () => null,
  getDistributions: async () => ({ results: [] }),
  getMedia: async () => ({ results: [] }),
  getMetrics: async () => null,
  countOccurrences: async () => 0,
  checkApiHealth: async () => ({ status: 'offline-stub' }),
};

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
 * Option `offlineGbif: true` pour des tests sans dépendance réseau.
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideModule(CacheModule)
    .useModule(TestCacheModule);

  if (options.offlineGbif) {
    builder = builder.overrideProvider(GbifService).useValue(offlineGbifStub);
  }

  const moduleFixture: TestingModule = await builder.compile();

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
