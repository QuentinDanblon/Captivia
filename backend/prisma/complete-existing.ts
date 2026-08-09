/**
 * COMPLÈTE les profils espèces existants (IDs GBIF) sans onglets satellites
 * en leur appliquant le template générique de leur catégorie.
 * Idempotent : ne touche que les fiches SANS feeding (les autres sont complètes).
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CATEGORY_TEMPLATE: Record<string, string> = {
  mammifère: 'mammifere-nac',
  oiseau: 'oiseau-nac',
  reptile: 'reptile-nac',
  amphibien: 'amphibien-nac',
  poisson: 'poisson-nac',
  insecte: 'insecte-nac',
  arachnide: 'arachnide-nac',
};

async function main() {
  const idxPath = path.resolve(__dirname, 'templates/index.json');
  const templates = JSON.parse(fs.readFileSync(idxPath, 'utf-8')) as Array<Record<string, any>>;
  const byKey = new Map(templates.map((t) => [t.especeKey, t]));

  const profiles = await prisma.speciesProfile.findMany({
    where: { speciesId: { lt: 2000000000 } },
  });
  console.log(`📋 ${profiles.length} profils espèces existants`);

  let ok = 0;
  const skipped: string[] = [];
  for (const p of profiles) {
    const existing = await prisma.speciesFeeding.findUnique({
      where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
    });
    const tmplKey = CATEGORY_TEMPLATE[p.category] || 'mammifere-nac';
    const tmpl = byKey.get(tmplKey);
    if (!tmpl) {
      skipped.push(`${p.commonNameFr} (template ${tmplKey} absent)`);
      continue;
    }

    // Complète CHAQUE section manquante indépendamment (idempotent par section)
    if (!existing) {
      await prisma.speciesFeeding.upsert({
        where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
        update: {
          dietType: tmpl.feeding.dietType,
          recommendedFoods: tmpl.feeding.recommendedFoods,
          foodsToAvoid: tmpl.feeding.foodsToAvoid,
          mealFrequency: tmpl.feeding.mealFrequency,
          specificNeeds: tmpl.feeding.specificNeeds,
          sources: tmpl.feeding.sources ?? [],
        },
        create: {
          speciesId: p.speciesId, locale: 'fr',
          dietType: tmpl.feeding.dietType,
          recommendedFoods: tmpl.feeding.recommendedFoods,
          foodsToAvoid: tmpl.feeding.foodsToAvoid,
          mealFrequency: tmpl.feeding.mealFrequency,
          specificNeeds: tmpl.feeding.specificNeeds,
          sources: tmpl.feeding.sources ?? [],
        },
      });
    }
    const habitat = await prisma.speciesHabitat.findUnique({
      where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
    });
    if (!habitat) {
      await prisma.speciesHabitat.upsert({
        where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
        update: { ...tmpl.habitat },
        create: { speciesId: p.speciesId, locale: 'fr', ...tmpl.habitat },
      });
    }
    const behavior = await prisma.speciesBehavior.findUnique({
      where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
    });
    if (!behavior) {
      await prisma.speciesBehavior.upsert({
        where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
        update: { ...tmpl.behavior },
        create: { speciesId: p.speciesId, locale: 'fr', ...tmpl.behavior },
      });
    }
    const health = await prisma.speciesHealthContent.findUnique({
      where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
    });
    if (!health) {
      await prisma.speciesHealthContent.upsert({
        where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
        update: { diseases: tmpl.health.diseases, sources: tmpl.health.sources ?? [] },
        create: { speciesId: p.speciesId, locale: 'fr', diseases: tmpl.health.diseases, sources: tmpl.health.sources ?? [] },
      });
    }
    const legislation = await prisma.speciesLegislation.findUnique({
      where: { speciesId_country: { speciesId: p.speciesId, country: tmpl.legislation.country } },
    });
    if (!legislation) {
      await prisma.speciesLegislation.upsert({
        where: { speciesId_country: { speciesId: p.speciesId, country: tmpl.legislation.country } },
        update: { status: tmpl.legislation.status, details: tmpl.legislation.details, sources: (tmpl.legislation.sources ?? []).map((s: any) => s.url) },
        create: { speciesId: p.speciesId, country: tmpl.legislation.country, status: tmpl.legislation.status, details: tmpl.legislation.details, sources: (tmpl.legislation.sources ?? []).map((s: any) => s.url) },
      });
    }
    const reproduction = await prisma.speciesReproduction.findUnique({
      where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
    });
    if (!reproduction) {
      await prisma.speciesReproduction.upsert({
        where: { speciesId_locale: { speciesId: p.speciesId, locale: 'fr' } },
        update: { ...tmpl.reproduction },
        create: { speciesId: p.speciesId, locale: 'fr', ...tmpl.reproduction },
      });
    }
    ok++;
  }

  console.log(`✅ Complétés: ${ok}`);
  console.log(`Skippés (déjà complets ou sans template): ${skipped.length}`);
  for (const s of skipped.slice(0, 10)) console.log('  -', s);
}

main().catch((e) => { console.error('FATAL:', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
