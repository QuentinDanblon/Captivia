/**
 * W5-04 — import-enrichment pose `SpeciesProfile.lastReviewedAt` d'après le rapport verify/<LOT>.json.
 * Prérequis : DATABASE_URL pointe vers une base migrée.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  importEnrichment,
  reviewDateFor,
  startOfUtcDay,
} from '../prisma/import-enrichment';

jest.setTimeout(60000);

describe('import-enrichment — lastReviewedAt (W5-04)', () => {
  const prisma = new PrismaClient();
  const base = 1_950_000_000 + Math.floor(Math.random() * 1_000_000) * 10;
  const ids = [base + 1, base + 2, base + 3, base + 4];
  let tmp: string;

  const writeLot = (
    name: string,
    entries: unknown[],
    report: unknown,
    mtime?: Date,
  ) => {
    fs.writeFileSync(
      path.join(tmp, 'out', `${name}.json`),
      JSON.stringify(entries),
    );
    const reportPath = path.join(tmp, 'verify', `${name}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report));
    if (mtime) fs.utimesSync(reportPath, mtime, mtime);
  };
  const entry = (speciesId: number) => ({
    speciesId,
    description: `Description de test ${speciesId}.`,
    sourceUrl: 'https://fr.wikipedia.org/wiki/Test',
  });

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'enrich-'));
    fs.mkdirSync(path.join(tmp, 'out'));
    fs.mkdirSync(path.join(tmp, 'verify'));
    for (const speciesId of ids) {
      await prisma.speciesProfile.create({
        data: {
          speciesId,
          commonNameFr: `Enrich ${speciesId}`,
          scientificName: `Enrichus ${speciesId}`,
          category: 'mammifère',
          domesticationType: 'NAC',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.speciesProfile.deleteMany({
      where: { speciesId: { in: ids } },
    });
    await prisma.$disconnect();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const reviewedAt = (id: number) =>
    prisma.speciesProfile.findUnique({
      where: { speciesId: id },
      select: { lastReviewedAt: true },
    });

  it("reviewDateFor : reviewedAt de l'entrée > reviewedAt du rapport > mtime arrondi au jour", () => {
    const p = path.join(tmp, 'verify', 'unit.json');
    fs.writeFileSync(
      p,
      JSON.stringify([
        { speciesId: 1, reviewedAt: '2026-08-01' },
        { speciesId: 2 },
      ]),
    );
    const mtime = new Date('2026-07-10T15:42:11.000Z');
    fs.utimesSync(p, mtime, mtime);
    expect(reviewDateFor(p, 1).toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(reviewDateFor(p, 2).toISOString()).toBe('2026-07-10T00:00:00.000Z');

    fs.writeFileSync(
      p,
      JSON.stringify({
        reviewedAt: '2026-06-30T12:00:00Z',
        entries: [{ speciesId: 2 }],
      }),
    );
    expect(reviewDateFor(p, 2).toISOString()).toBe('2026-06-30T12:00:00.000Z');
    expect(startOfUtcDay(new Date('2026-07-10T23:59:59Z')).toISOString()).toBe(
      '2026-07-10T00:00:00.000Z',
    );
  });

  it('renseigne la date du rapport (mtime arrondi) pour les fiches dont du contenu est importé', async () => {
    writeLot(
      'T1',
      [entry(ids[0])],
      [{ speciesId: ids[0], status: 'verified' }],
      new Date('2026-05-12T18:30:00.000Z'),
    );
    const report = await importEnrichment(prisma, path.join(tmp, 'out'));
    expect(report.created.description).toBe(1);
    expect(report.reviewed).toBe(1);
    expect((await reviewedAt(ids[0]))?.lastReviewedAt?.toISOString()).toBe(
      '2026-05-12T00:00:00.000Z',
    );
  });

  it('utilise reviewedAt du rapport quand il existe', async () => {
    writeLot(
      'T2',
      [entry(ids[1])],
      [{ speciesId: ids[1], reviewedAt: '2026-09-01' }],
    );
    await importEnrichment(prisma, path.join(tmp, 'out'));
    expect((await reviewedAt(ids[1]))?.lastReviewedAt?.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });

  it('ne recule jamais une date plus récente déjà en base', async () => {
    const newer = new Date('2027-01-01T00:00:00.000Z');
    await prisma.speciesProfile.update({
      where: { speciesId: ids[2] },
      data: { lastReviewedAt: newer },
    });
    writeLot(
      'T3',
      [entry(ids[2])],
      [{ speciesId: ids[2], reviewedAt: '2026-03-01' }],
    );
    await importEnrichment(prisma, path.join(tmp, 'out'));
    expect((await reviewedAt(ids[2]))?.lastReviewedAt?.toISOString()).toBe(
      newer.toISOString(),
    );
  });

  it("ne date pas une fiche dont rien n'est importé", async () => {
    await prisma.speciesProfile.update({
      where: { speciesId: ids[3] },
      data: { description: 'Déjà décrite.' },
    });
    writeLot(
      'T4',
      [entry(ids[3])],
      [{ speciesId: ids[3], reviewedAt: '2026-09-01' }],
    );
    await importEnrichment(prisma, path.join(tmp, 'out'));
    expect((await reviewedAt(ids[3]))?.lastReviewedAt).toBeNull();
  });
});
