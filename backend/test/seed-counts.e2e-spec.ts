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
    fs.readFileSync(path.resolve(__dirname, '../prisma/breeds-data.json'), 'utf-8'),
  );

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('contient au moins 296 fiches espèces (GBIF)', async () => {
    const count = await prisma.speciesProfile.count({ where: { speciesId: { lt: 2_000_000_001 } } });
    expect(count).toBeGreaterThanOrEqual(296);
  });

  it('contient les races de breeds-data.json, hors entrées non animales exclues', async () => {
    expect(breeds.length).toBeGreaterThanOrEqual(1379);
    const excluded: number[] = (
      JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '..', 'prisma', 'enrichment', 'excluded-breed-ids.json'), 'utf-8'),
      ) as { ids: number[] }
    ).ids;
    const kept = breeds.filter((b) => !excluded.includes(b.speciesId));
    const found = await prisma.speciesProfile.count({
      where: { speciesId: { in: kept.map((b) => b.speciesId) } },
    });
    expect(found).toBe(kept.length);
    // Aucune entrée non animale (outils, objets, Q-ids Wikidata) en base.
    expect(await prisma.speciesProfile.count({ where: { speciesId: { in: excluded } } })).toBe(0);
    const races = await prisma.speciesProfile.count({ where: { speciesId: { gte: 2_000_000_001 } } });
    expect(races).toBeGreaterThanOrEqual(1211);
  });

  it('a un contenu satellite pour chaque race (alimentation, habitat, comportement, santé, législation, reproduction)', async () => {
    const where = { speciesId: { gte: 2_000_000_001 } };
    const [feeding, habitat, behavior, health, legislation, reproduction] = await Promise.all([
      prisma.speciesFeeding.count({ where }),
      prisma.speciesHabitat.count({ where }),
      prisma.speciesBehavior.count({ where }),
      prisma.speciesHealthContent.count({ where }),
      prisma.speciesLegislation.count({ where }),
      prisma.speciesReproduction.count({ where }),
    ]);
    for (const n of [feeding, habitat, behavior, health, legislation, reproduction]) {
      expect(n).toBeGreaterThanOrEqual(1211);
    }
  });

  it('persiste sourceUrl pour les profils qui en fournissent une', async () => {
    const withUrl = await prisma.speciesProfile.count({ where: { sourceUrl: { not: null } } });
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
