import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Boot NestJS + Prisma peut prendre du temps sur Windows
jest.setTimeout(60000);

const PASSWORD = 'ModuleD123!';

// Gecko léopard (Eublepharis macularius) — catégorie reptile → 3 modèles seedés
const SPECIES_GECKO = 5221172;

const VALID_TYPES = ['nourrissage', 'entretien', 'uvb', 'controle'];
const VALID_FREQUENCIES = [
  'daily',
  'every_2_days',
  'every_3_days',
  'weekly',
  'monthly',
  'once',
  'hourly',
  'custom',
];

/** Email jetable unique. */
function makeEmail(tag: string): string {
  return `module-d-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@captivia.local`;
}

describe('Module D E2E — modèles de routines par défaut par espèce', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdEmails: string[] = [];

  /** Crée un compte jetable directement en base et signe un JWT valide. */
  async function createUser(
    email: string,
    isPremium = false,
  ): Promise<{ email: string; token: string; userId: string }> {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, locale: 'fr', isPremium },
    });
    createdEmails.push(email);
    const token = jwtService.sign({ sub: user.id, email: user.email });
    return { email, token, userId: user.id };
  }

  async function createAnimal(
    token: string,
    name: string,
    speciesId = SPECIES_GECKO,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesId, name, sex: 'male' })
      .expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    // Nettoyage : suppression des comptes jetables (cascade animaux, routines…).
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  describe('1. GET routine-templates', () => {
    let token: string;
    let animalId: string;

    it('espèce seedée → 200, ≥ 1 template, types/fréquences valides, tri par order', async () => {
      const acc = await createUser(makeEmail('templates'));
      token = acc.token;
      animalId = await createAnimal(token, 'Rango Gecko');

      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/routine-templates`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Champs du modèle présents
      for (const tpl of res.body) {
        expect(tpl).toHaveProperty('id');
        expect(tpl).toHaveProperty('speciesId', SPECIES_GECKO);
        expect(VALID_TYPES).toContain(tpl.type);
        expect(VALID_FREQUENCIES).toContain(tpl.frequency);
        expect(tpl).toHaveProperty('schedule');
        expect(typeof tpl.order).toBe('number');
        expect(tpl.active).toBe(true);
      }

      // Tri par order ascendant
      const orders = res.body.map((t: { order: number }) => t.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));

      // Reptile → nourrissage + UVB + entretien (les 3 types attendus)
      const types = res.body.map((t: { type: string }) => t.type);
      expect(types).toContain('nourrissage');
      expect(types).toContain('uvb');
      expect(types).toContain('entretien');
    });

    it('sans token → 401', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/routine-templates`)
        .expect(401);
    });

    it('animal inconnu → 404', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${crypto.randomUUID()}/routine-templates`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('animal d’un autre utilisateur → 403', async () => {
      const other = await createUser(makeEmail('other'));
      const otherAnimalId = await createAnimal(
        other.token,
        'Animal de l’autre',
      );

      await request(app.getHttpServer())
        .get(`/users/me/animals/${otherAnimalId}/routine-templates`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
