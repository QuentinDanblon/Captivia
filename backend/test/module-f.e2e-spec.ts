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

const PASSWORD = 'ModuleF123!';

/** Email jetable unique. */
function makeEmail(tag: string): string {
  return `module-f-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@captivia.local`;
}

describe('Module F E2E — parenté (père/mère) & groupement', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdEmails: string[] = [];

  async function createUser(
    email: string,
    isPremium: boolean,
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
    sex: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesId: 5221172, name, sex })
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
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  describe('1. Validations parenté (update)', () => {
    let token: string;
    let maleId: string;
    let otherMaleId: string;
    let femaleId: string;
    let babyId: string;
    let unknownId: string;

    it('setup : compte premium + 5 animaux (2 male/femelle/bebe/inconnu)', async () => {
      const acc = await createUser(makeEmail('parents'), true);
      token = acc.token;
      maleId = await createAnimal(token, 'F-Pere', 'male');
      otherMaleId = await createAnimal(token, 'F-AutreMale', 'male');
      femaleId = await createAnimal(token, 'F-Mere', 'female');
      babyId = await createAnimal(token, 'F-Bebe', 'unknown');
      unknownId = await createAnimal(token, 'F-Inconnu', 'unknown');
    });

    it('PATCH male.fatherId = femelle → 400 (sexe incohérent : père doit être male)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: femaleId })
        .expect(400);
      expect(res.body.message).toContain('Father must be a male animal');
    });

    it('PATCH male.motherId = autre male → 400 (sexe incohérent : mère doit être female)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ motherId: otherMaleId })
        .expect(400);
      expect(res.body.message).toContain('Mother must be a female animal');
    });

    it('PATCH male.fatherId = lui-même → 400 (self-parent)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: maleId })
        .expect(400);
      expect(res.body.message).toContain('An animal cannot be its own parent');
    });

    it("PATCH male.fatherId = animal d'un autre user → 400 (same owner)", async () => {
      const other = await createUser(makeEmail('other-parent'), true);
      const otherMaleId = await createAnimal(other.token, 'F-Other', 'male');

      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: otherMaleId })
        .expect(400);
      expect(res.body.message).toContain(
        'Parent must belong to the same owner',
      );
    });

    it('PATCH fatherId inexistant → 400 (same owner)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: crypto.randomUUID() })
        .expect(400);
      expect(res.body.message).toContain(
        'Parent must belong to the same owner',
      );
    });

    it('PATCH fatherId non-UUID → 400 (DTO)', () => {
      return request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: 'pas-un-uuid' })
        .expect(400);
    });

    it('PATCH groupName > 100 chars → 400 (DTO MaxLength)', () => {
      return request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ groupName: 'x'.repeat(101) })
        .expect(400);
    });

    it('PATCH groupName 100 chars → 200 (limite exacte acceptée)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${maleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ groupName: 'y'.repeat(100) })
        .expect(200);
      expect(res.body.groupName).toHaveLength(100);
    });

    it('PATCH bebe.fatherId = parent sexe unknown → 200 (accepté)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: unknownId })
        .expect(200);
      expect(res.body.father).toMatchObject({ id: unknownId, sex: 'unknown' });
    });

    it('PATCH bebe.fatherId = null → 200 (lien effacé)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: null })
        .expect(200);
      expect(res.body.fatherId).toBeNull();
      expect(res.body.father).toBeNull();
    });

    it('PATCH valide : bebe.fatherId=male, motherId=femelle → 200 avec parents', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: maleId, motherId: femaleId })
        .expect(200);

      expect(res.body.fatherId).toBe(maleId);
      expect(res.body.motherId).toBe(femaleId);
      expect(res.body.father).toMatchObject({
        id: maleId,
        name: 'F-Pere',
        sex: 'male',
      });
      expect(res.body.father.photos).toEqual([]);
      expect(res.body.mother).toMatchObject({
        id: femaleId,
        name: 'F-Mere',
        sex: 'female',
      });
    });

    it('findOne retourne les parents (id, name, sex, photos)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.father).toMatchObject({
        id: maleId,
        name: 'F-Pere',
        sex: 'male',
      });
      expect(res.body.father.photos).toEqual([]);
      expect(res.body.mother).toMatchObject({
        id: femaleId,
        name: 'F-Mere',
        sex: 'female',
      });
      expect(res.body.mother.photos).toEqual([]);
    });

    it('findAll inclut les parents', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const baby = res.body.find((a: { id: string }) => a.id === babyId);
      expect(baby).toBeDefined();
      expect(baby.father).toMatchObject({ id: maleId, sex: 'male' });
      expect(baby.mother).toMatchObject({ id: femaleId, sex: 'female' });
    });

    it('PATCH groupName → 200 (trim + persistance)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ groupName: '  Enclos Nord  ' })
        .expect(200);
      expect(res.body.groupName).toBe('Enclos Nord');

      const get = await request(app.getHttpServer())
        .get(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(get.body.groupName).toBe('Enclos Nord');
    });
  });

  describe('2. Endpoint offspring (portée)', () => {
    let token: string;
    let maleId: string;
    let femaleId: string;
    let babyId: string;
    let otherToken: string;
    let otherAnimalId: string;

    it('setup : male/femelle/bebe liés + compte tiers', async () => {
      const acc = await createUser(makeEmail('offspring'), true);
      token = acc.token;
      maleId = await createAnimal(token, 'F-Pere', 'male');
      femaleId = await createAnimal(token, 'F-Mere', 'female');
      babyId = await createAnimal(token, 'F-Bebe', 'unknown');

      await request(app.getHttpServer())
        .patch(`/users/me/animals/${babyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fatherId: maleId, motherId: femaleId })
        .expect(200);

      const other = await createUser(makeEmail('offspring-other'), true);
      otherToken = other.token;
      otherAnimalId = await createAnimal(other.token, 'F-Autre', 'male');
    });

    it('GET offspring du male → contient bebe (fatherId)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${maleId}/offspring`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const baby = res.body.find((a: { id: string }) => a.id === babyId);
      expect(baby).toBeDefined();
      expect(baby).toMatchObject({
        fatherId: maleId,
        motherId: femaleId,
        name: 'F-Bebe',
        sex: 'unknown',
      });
      expect(baby).toHaveProperty('birthDate');
      expect(baby).toHaveProperty('photos');
    });

    it('GET offspring de la femelle → contient bebe (motherId)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${femaleId}/offspring`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.some((a: { id: string }) => a.id === babyId)).toBe(true);
    });

    it('GET offspring animal sans petits → []', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${babyId}/offspring`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('GET offspring animal d’autrui → 403', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${maleId}/offspring`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('GET offspring animal inexistant → 404', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${crypto.randomUUID()}/offspring`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('GET offspring sans token → 401', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${maleId}/offspring`)
        .expect(401);
    });
  });

  describe('3. Parenté à la création (create)', () => {
    let token: string;
    let maleId: string;
    let femaleId: string;

    it('setup : compte premium + male/femelle', async () => {
      const acc = await createUser(makeEmail('create-parents'), true);
      token = acc.token;
      maleId = await createAnimal(token, 'C-Pere', 'male');
      femaleId = await createAnimal(token, 'C-Mere', 'female');
    });

    it('POST avec fatherId=femelle → 400 (sexe incohérent)', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speciesId: 5221172,
          name: 'C-BebeX',
          sex: 'unknown',
          fatherId: femaleId,
        })
        .expect(400);
      expect(res.body.message).toContain('Father must be a male animal');
    });

    it('POST avec fatherId + motherId valides → 201 avec parents', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speciesId: 5221172,
          name: 'C-Bebe',
          sex: 'unknown',
          fatherId: maleId,
          motherId: femaleId,
          groupName: 'Portée 1',
        })
        .expect(201);

      expect(res.body.fatherId).toBe(maleId);
      expect(res.body.motherId).toBe(femaleId);
      expect(res.body.father).toMatchObject({ id: maleId, sex: 'male' });
      expect(res.body.mother).toMatchObject({ id: femaleId, sex: 'female' });
      expect(res.body.groupName).toBe('Portée 1');
    });
  });
});
