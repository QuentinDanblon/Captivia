/**
 * W5-01 — Comptages minimaux sur une base seedée (`npx prisma db seed`).
 * Prérequis : DATABASE_URL pointe vers une base migrée ET seedée.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('Seed complet (comptages minimaux)', () => {
  const prisma = new PrismaClient();
  const breeds: Array<{ speciesId: number }> = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../prisma/breeds-data.json'),
      'utf-8',
    ),
  );

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('contient au moins 296 fiches espèces (GBIF)', async () => {
    const count = await prisma.speciesProfile.count({
      where: { speciesId: { lt: 2_000_000_001 } },
    });
    expect(count).toBeGreaterThanOrEqual(296);
  });

  it('contient les races de breeds-data.json, hors entrées non animales exclues', async () => {
    expect(breeds.length).toBeGreaterThanOrEqual(1379);
    const excluded: number[] = (
      JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            '..',
            'prisma',
            'enrichment',
            'excluded-breed-ids.json',
          ),
          'utf-8',
        ),
      ) as { ids: number[] }
    ).ids;
    const kept = breeds.filter((b) => !excluded.includes(b.speciesId));
    const found = await prisma.speciesProfile.count({
      where: { speciesId: { in: kept.map((b) => b.speciesId) } },
    });
    expect(found).toBe(kept.length);
    // Aucune entrée non animale (outils, objets, Q-ids Wikidata) en base.
    expect(
      await prisma.speciesProfile.count({
        where: { speciesId: { in: excluded } },
      }),
    ).toBe(0);
    const races = await prisma.speciesProfile.count({
      where: { speciesId: { gte: 2_000_000_001 } },
    });
    expect(races).toBeGreaterThanOrEqual(1211);
  });

  it('aucune race ne porte de section générée par modèle (B1 : sources génériques des modèles)', async () => {
    // Titres des sources des modèles éditoriaux par espèce (prisma/templates/*.json).
    const templatesDir = path.resolve(__dirname, '..', 'prisma', 'templates');
    const titles = new Set<string>();
    for (const file of fs.readdirSync(templatesDir)) {
      if (!file.startsWith('template-')) continue;
      const t = JSON.parse(
        fs.readFileSync(path.join(templatesDir, file), 'utf-8'),
      ) as Record<string, { sources?: Array<{ title?: string }> } | null>;
      for (const section of Object.values(t)) {
        if (section && typeof section === 'object' && 'sources' in section) {
          for (const src of section.sources ?? []) {
            if (src.title) titles.add(src.title);
          }
        }
      }
    }
    expect(titles.size).toBeGreaterThan(20);
    const [row] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM (
        SELECT "speciesId", "sources" FROM "SpeciesFeeding"
        UNION ALL SELECT "speciesId", "sources" FROM "SpeciesHabitat"
        UNION ALL SELECT "speciesId", "sources" FROM "SpeciesBehavior"
        UNION ALL SELECT "speciesId", "sources" FROM "SpeciesHealthContent"
        UNION ALL SELECT "speciesId", "sources" FROM "SpeciesReproduction"
      ) s
      WHERE s."speciesId" >= 2000000001
        AND jsonb_typeof(s."sources") = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(s."sources") src
          WHERE src->>'title' = ANY(${[...titles]}::text[])
        )`;
    expect(Number(row.n)).toBe(0);
    // Aucun chat, chien ou cheval classé « Rongeur ».
    expect(
      await prisma.speciesProfile.count({
        where: {
          speciesId: { gte: 2_000_000_001 },
          subcategory: 'Rongeur',
          scientificName: {
            in: [
              'Felis catus',
              'Canis lupus familiaris',
              'Equus ferus caballus',
            ],
          },
        },
      }),
    ).toBe(0);
  });

  it('persiste sourceUrl pour les profils qui en fournissent une', async () => {
    const withUrl = await prisma.speciesProfile.count({
      where: { sourceUrl: { not: null } },
    });
    expect(withUrl).toBeGreaterThanOrEqual(1000);
  });

  it("ne contient aucun magasin d'affiliation factice (example-)", async () => {
    const fake = await prisma.affiliateStore.count({
      where: {
        OR: [
          { name: { contains: 'example-', mode: 'insensitive' } },
          { url: { contains: 'example-', mode: 'insensitive' } },
        ],
      },
    });
    expect(fake).toBe(0);
  });
});
