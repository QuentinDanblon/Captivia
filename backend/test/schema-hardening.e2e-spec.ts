/**
 * W1-09 — durcissement du schéma (CHECK, FK, unicité, index trigram)
 * W5-04 — `lastReviewedAt` exposé par l'API de la fiche espèce.
 * Prérequis : DATABASE_URL pointe vers une base migrée ET seedée.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('Schema hardening E2E (W1-09 / W5-04)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  // Fiches jetables hors plage GBIF / races : jamais en collision avec le seed.
  const base = 1_900_000_000 + Math.floor(Math.random() * 1_000_000) * 10;
  const REVIEWED_ID = base + 1;
  const UNREVIEWED_ID = base + 2;
  const REVIEWED_AT = new Date('2026-09-15T00:00:00.000Z');

  let userId: string;
  let animalId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const profile = (
      speciesId: number,
      name: string,
      lastReviewedAt: Date | null,
    ) => ({
      speciesId,
      commonNameFr: name,
      scientificName: `Testus ${name}`,
      category: 'mammifère',
      domesticationType: 'NAC',
      lastReviewedAt,
    });
    await prisma.speciesProfile.create({
      data: profile(REVIEWED_ID, `Verifie ${tag}`, REVIEWED_AT),
    });
    await prisma.speciesProfile.create({
      data: profile(UNREVIEWED_ID, `NonVerifie ${tag}`, null),
    });

    const user = await prisma.user.create({
      data: { email: `schema-${tag}@captivia.local`, passwordHash: 'x' },
    });
    userId = user.id;
    const animal = await prisma.animal.create({
      data: { userId, speciesId: REVIEWED_ID, name: 'Testy' },
    });
    animalId = animal.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.speciesProfile.deleteMany({
        where: { speciesId: { in: [REVIEWED_ID, UNREVIEWED_ID] } },
      });
    }
    if (app) await app.close();
  });

  describe('CHECK', () => {
    it('Animal.sex hors liste est rejeté ; les valeurs valides et NULL passent', async () => {
      await expect(
        prisma.animal.create({
          data: { userId, speciesId: REVIEWED_ID, name: 'X', sex: 'chimère' },
        }),
      ).rejects.toThrow(/Animal_sex_check|constraint/i);
      for (const sex of ['male', 'female', 'unknown', null]) {
        await prisma.animal.create({
          data: { userId, speciesId: REVIEWED_ID, name: `S-${sex}`, sex },
        });
      }
    });

    it('AnimalHealthRecord.type hors liste est rejeté', async () => {
      await expect(
        prisma.animalHealthRecord.create({
          data: { animalId, type: 'weird', title: 't', date: new Date() },
        }),
      ).rejects.toThrow(/AnimalHealthRecord_type_check|constraint/i);
      await prisma.animalHealthRecord.create({
        data: { animalId, type: 'vaccine', title: 't', date: new Date() },
      });
    });

    it('SpeciesLegislation.status hors liste est rejeté', async () => {
      await expect(
        prisma.speciesLegislation.create({
          data: {
            speciesId: REVIEWED_ID,
            country: 'FR',
            status: 'maybe',
            details: {},
            sources: [],
          },
        }),
      ).rejects.toThrow(/SpeciesLegislation_status_check|constraint/i);
      await prisma.speciesLegislation.create({
        data: {
          speciesId: REVIEWED_ID,
          country: 'FR',
          status: 'permit_required',
          details: {},
          sources: [],
        },
      });
    });

    it('Medication.frequency et VetAppointment.status hors liste sont rejetés', async () => {
      await expect(
        prisma.medication.create({
          data: {
            animalId,
            name: 'm',
            dose: '1',
            frequency: 'hourly',
            startDate: new Date(),
          },
        }),
      ).rejects.toThrow(/Medication_frequency_check|constraint/i);
      await expect(
        prisma.vetAppointment.create({
          data: { animalId, vetName: 'v', date: new Date(), status: 'pending' },
        }),
      ).rejects.toThrow(/VetAppointment_status_check|constraint/i);
    });

    it('colonnes énumérées des fiches espèces : SpeciesProfile, Habitat, Behavior', async () => {
      await expect(
        prisma.speciesProfile.create({
          data: {
            speciesId: base + 9,
            commonNameFr: 'X',
            scientificName: 'X x',
            category: 'licorne',
            domesticationType: 'NAC',
          },
        }),
      ).rejects.toThrow(/SpeciesProfile_category_check|constraint/i);
      await expect(
        prisma.speciesBehavior.create({
          data: {
            speciesId: REVIEWED_ID,
            generalBehavior: 'x',
            sociability: 'zzz',
            difficultyLevel: 'expert',
          },
        }),
      ).rejects.toThrow(/SpeciesBehavior_sociability_check|constraint/i);
    });
  });

  describe('Clés étrangères Species* -> SpeciesProfile', () => {
    it('une section sans fiche est rejetée (P2003)', async () => {
      await expect(
        prisma.speciesFeeding.create({
          data: {
            speciesId: base + 8,
            dietType: 'herbivore',
            recommendedFoods: [],
            foodsToAvoid: [],
            mealFrequency: 'daily',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('supprimer une fiche supprime ses sections (ON DELETE CASCADE)', async () => {
      const id = base + 7;
      await prisma.speciesProfile.create({
        data: {
          speciesId: id,
          commonNameFr: `Casc ${tag}`,
          scientificName: 'Casc casc',
          category: 'oiseau',
          domesticationType: 'NAC',
        },
      });
      await prisma.speciesFeeding.create({
        data: {
          speciesId: id,
          dietType: 'omnivore',
          recommendedFoods: [],
          foodsToAvoid: [],
          mealFrequency: 'daily',
        },
      });
      await prisma.speciesRoutineTemplate.create({
        data: {
          speciesId: id,
          type: 'nourrissage',
          frequency: 'daily',
          schedule: {},
          order: 0,
        },
      });
      await prisma.speciesProfile.delete({ where: { speciesId: id } });
      expect(
        await prisma.speciesFeeding.count({ where: { speciesId: id } }),
      ).toBe(0);
      expect(
        await prisma.speciesRoutineTemplate.count({ where: { speciesId: id } }),
      ).toBe(0);
    });
  });

  describe('Unicité NotificationEvent', () => {
    it('un doublon (userId, sourceKey, scheduledAt) est rejeté (P2002)', async () => {
      const data = {
        userId,
        type: 'Nourrissage',
        scheduledAt: new Date('2026-10-04T08:00:00.000Z'),
        sourceKey: `routine:${crypto.randomUUID()}`,
      };
      await prisma.notificationEvent.create({ data });
      await expect(
        prisma.notificationEvent.create({ data }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('Index trigram', () => {
    it('existent sur SpeciesProfile.commonNameFr et scientificName (GIN gin_trgm_ops)', async () => {
      const rows = await prisma.$queryRaw<
        { indexname: string; indexdef: string }[]
      >`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'SpeciesProfile' AND indexname LIKE '%trgm_idx'`;
      expect(rows.map((r) => r.indexname).sort()).toEqual([
        'SpeciesProfile_commonNameFr_trgm_idx',
        'SpeciesProfile_scientificName_trgm_idx',
      ]);
      for (const r of rows) {
        expect(r.indexdef).toMatch(/USING gin/i);
        expect(r.indexdef).toMatch(/gin_trgm_ops/);
      }
    });
  });

  describe('lastReviewedAt (W5-04)', () => {
    it('GET /species/:id expose lastReviewedAt (ISO) pour une fiche vérifiée', async () => {
      const res = await request(app.getHttpServer())
        .get(`/species/${REVIEWED_ID}`)
        .expect(200);
      expect(res.body.lastReviewedAt).toBe(REVIEWED_AT.toISOString());
      expect(res.body.profile.lastReviewedAt).toBe(REVIEWED_AT.toISOString());
    });

    it('GET /species/:id renvoie lastReviewedAt = null pour une fiche jamais vérifiée', async () => {
      const res = await request(app.getHttpServer())
        .get(`/species/${UNREVIEWED_ID}`)
        .expect(200);
      expect(res.body).toHaveProperty('lastReviewedAt', null);
    });

    it('GET /species/search expose lastReviewedAt dans chaque résultat', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/species/search?q=${encodeURIComponent(`Verifie ${tag}`)}&limit=5`,
        )
        .expect(200);
      const hit = (
        res.body.results as Array<{
          key: number;
          lastReviewedAt: string | null;
        }>
      ).find((r) => r.key === REVIEWED_ID);
      expect(hit).toBeDefined();
      expect(hit?.lastReviewedAt).toBe(REVIEWED_AT.toISOString());
    });
  });
});
