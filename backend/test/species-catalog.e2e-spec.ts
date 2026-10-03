/**
 * Catalogue des espèces sur une base seedée (`npx prisma db seed`) :
 *  - B1 : une race sans section hérite des sections sourcées de son espèce parente, jamais d'un
 *    modèle d'un autre animal ;
 *  - M10 : recherche triée par pertinence, noms courants dans les autres langues ;
 *  - M11 : classification GBIF cohérente avec le nom scientifique local ;
 *  - audit 5 : animal d'une espèce absente du catalogue (repli GBIF) → fiche minimale ou 400
 *    avec un `code`, jamais 500.
 * Aucun accès réseau : fixtures GBIF de test/utils/fake-external-adapter.ts.
 */
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, TestApp } from './utils/create-app';
import { AuthBody, ErrorBody, IdBody, bodyOf } from './utils/http';

interface SearchBody {
  total: number;
  source: string;
  results: Array<{ key: number; name: string }>;
}

interface SpeciesBody {
  key: number;
  kingdom: string;
  class: string;
  family: string;
  genus: string;
  gbifKey: number | null;
  profile: { subcategory: string | null } | null;
  feeding: { speciesId: number; dietType: string } | null;
  inheritedFrom: { speciesId: number; sections: string[] } | null;
}

interface HealthBody {
  editorial: { diseases: Array<{ name: string }> } | null;
  inheritedFrom: { speciesId: number } | null;
}

const PERSAN = 2000000110;
const CHAT_DOMESTIQUE = 5281802;
const CHIEN = 5287871;
const LAPIN = 5283399;

describe('Catalogue des espèces (B1, M10, M11, audit 5)', () => {
  let testApp: TestApp;
  let prisma: PrismaService;
  const stamp = Date.now();
  const createdSpecies = 9001001;

  const http = () => request(testApp.url);

  async function rankOf(q: string, key: number): Promise<number> {
    const res = await http()
      .get(`/species/search?q=${encodeURIComponent(q)}&limit=100`)
      .expect(200);
    const body = bodyOf<SearchBody>(res);
    expect(body.source).toBe('profile');
    return body.results.findIndex((r) => r.key === key) + 1;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    prisma = testApp.app.get(PrismaService);
    await prisma.speciesProfile.deleteMany({
      where: { speciesId: createdSpecies, animals: { none: {} } },
    });
  });

  afterAll(async () => {
    await prisma.animal.deleteMany({
      where: {
        speciesId: createdSpecies,
        user: { email: { endsWith: `-${stamp}@captivia.com` } },
      },
    });
    await prisma.speciesProfile.deleteMany({
      where: { speciesId: createdSpecies, animals: { none: {} } },
    });
    await testApp.app.close();
  });

  describe('B1 — race sans section : sections de l’espèce parente', () => {
    it('Persan : alimentation et santé du chat domestique, sous-catégorie « Chat »', async () => {
      const res = await http().get(`/species/${PERSAN}`).expect(200);
      const body = bodyOf<SpeciesBody>(res);
      expect(body.profile?.subcategory).toBe('Chat');
      expect(body.feeding?.speciesId).toBe(CHAT_DOMESTIQUE);
      expect(body.feeding?.dietType).toBe('carnivore');
      expect(body.inheritedFrom).toMatchObject({
        speciesId: CHAT_DOMESTIQUE,
        sections: expect.arrayContaining(['feeding']) as unknown,
      });

      const health = bodyOf<HealthBody>(
        await http().get(`/species/${PERSAN}/health`).expect(200),
      );
      expect(health.inheritedFrom?.speciesId).toBe(CHAT_DOMESTIQUE);
      const names = (health.editorial?.diseases ?? []).map((d) => d.name);
      expect(names.join(' ')).not.toMatch(/myxomatose|stase digestive/i);
    });

    it('espèce (non-race) : aucune section héritée', async () => {
      const res = await http().get(`/species/${CHAT_DOMESTIQUE}`).expect(200);
      expect(bodyOf<SpeciesBody>(res).inheritedFrom).toBeNull();
    });
  });

  describe('M11 — classification', () => {
    it('« Chat domestique » : la mousse de la clé locale est écartée (rapprochement par nom)', async () => {
      const res = await http().get(`/species/${CHAT_DOMESTIQUE}`).expect(200);
      expect(bodyOf<SpeciesBody>(res)).toMatchObject({
        kingdom: 'Animalia',
        class: 'Mammalia',
        family: 'Felidae',
        genus: 'Felis',
        gbifKey: 2435035,
      });
    });
  });

  describe('M10 — recherche par pertinence', () => {
    it.each([
      ['chien', CHIEN],
      ['chat', CHAT_DOMESTIQUE],
      ['lapin', LAPIN],
      ['dog', CHIEN],
      ['cat', CHAT_DOMESTIQUE],
      ['Katze', CHAT_DOMESTIQUE],
    ])('« %s » place l’espèce en tête', async (q, key) => {
      expect(await rankOf(q, key)).toBe(1);
    });

    it('« chat » : les races de chat suivent, avant les correspondances de description', async () => {
      const res = await http()
        .get('/species/search?q=chat&limit=100')
        .expect(200);
      const keys = bodyOf<SearchBody>(res).results.map((r) => r.key);
      expect(keys).toContain(PERSAN);
    });
  });

  describe('audit 5 — espèce absente du catalogue', () => {
    let token: string;

    beforeAll(async () => {
      const res = await http()
        .post('/auth/register')
        .send({
          email: `catalog-${stamp}@captivia.com`,
          password: 'password123',
          acceptTerms: true,
          ageConfirmed: true,
        })
        .expect(201);
      token = bodyOf<AuthBody>(res).accessToken;
    });

    it('espèce animale GBIF : fiche minimale créée (sans données d’élevage), animal créé', async () => {
      const res = await http()
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId: createdSpecies, name: 'Fixture' })
        .expect(201);
      expect(bodyOf<IdBody>(res).id).toBeDefined();
      const profile = await prisma.speciesProfile.findUnique({
        where: { speciesId: createdSpecies },
        include: { feedings: true, healthContents: true },
      });
      expect(profile).toMatchObject({
        commonNameFr: 'Lézard de démonstration',
        scientificName: 'Fixturosaurus exemplaris',
        category: 'reptile',
        sourceUrl: `https://www.gbif.org/species/${createdSpecies}`,
      });
      expect(profile?.feedings).toEqual([]);
      expect(profile?.healthContents).toEqual([]);
      await prisma.animal.delete({ where: { id: bodyOf<IdBody>(res).id } });
    });

    it.each([
      [165689944, 'SPECIES_NOT_ANIMAL'],
      [2291582, 'SPECIES_UNSUPPORTED_GROUP'],
      [999999, 'SPECIES_NOT_FOUND'],
      [2000999999, 'SPECIES_NOT_FOUND'],
    ])('speciesId %s → 400 %s (jamais 500)', async (speciesId, code) => {
      const res = await http()
        .post('/users/me/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ speciesId, name: 'Refus' })
        .expect(400);
      expect(bodyOf<ErrorBody>(res).code).toBe(code);
      expect(await prisma.speciesProfile.count({ where: { speciesId } })).toBe(
        0,
      );
    });
  });
});
