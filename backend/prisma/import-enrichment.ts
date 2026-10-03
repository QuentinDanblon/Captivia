/**
 * IMPORT ENRICHMENT — comble les onglets manquants des fiches existantes à partir
 * des lots produits par le pipeline d'enrichissement (prisma/enrichment/out/*.json,
 * voir prisma/enrichment/CONTRACT.md).
 *
 * Règles (sûres pour la production, idempotentes) :
 *  - seuls les lots accompagnés d'un rapport de vérification (enrichment/verify/) sont importés ;
 *  - ne CRÉE une section que si elle n'existe pas encore (jamais d'écrasement) ;
 *  - ne renseigne `description` / `sourceUrl` que si la fiche n'en a pas ;
 *  - une section n'est importée que si elle est valide (énumérations autorisées,
 *    champs obligatoires) ET sourcée par au moins une URL https ; sinon ignorée ;
 *  - les fiches dont le speciesId n'existe pas sont ignorées.
 *
 * Usage : depuis backend/ : npx ts-node prisma/import-enrichment.ts
 * Appelé aussi à la fin de seed-prod.ts.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type Source = { type?: string; url?: string; title?: string };
type Json = Record<string, unknown>;

const HABITAT_TYPES = ['libre', 'cage', 'terrarium', 'aquarium', 'enclos', 'volière'];
const COST = ['faible', 'moyen', 'élevé'];
const SOCIABILITY = ['solitaire', 'grégaire', 'semi-grégaire'];
const DIFFICULTY = ['débutant', 'intermédiaire', 'expert'];
const MEAL_FREQ = ['daily', 'every_2_days', 'weekly', 'variable'];
const LEGAL_STATUS = ['allowed', 'permit_required', 'prohibited'];
const BREEDING = ['facile', 'modere', 'avance'];
const MAX_TEXT = 800;

export interface EnrichmentReport {
  files: number;
  entries: number;
  created: Record<string, number>;
  skipped: string[];
}

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = MAX_TEXT): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Synonymes fréquents produits par les rédacteurs → valeurs autorisées. */
function normDifficulty(v: string | undefined): string | undefined {
  if (!v) return v;
  const k = v.toLowerCase();
  if (['avance', 'avancé', 'difficile', 'confirmé'].includes(k)) return 'expert';
  if (['facile', 'debutant'].includes(k)) return 'débutant';
  if (['modere', 'modéré', 'moyen', 'intermediaire'].includes(k)) return 'intermédiaire';
  return v;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

/** URLs vérifiées mortes (404/410) lors de l'audit des liens : jamais retenues comme source. */
let DEAD_URLS = new Set<string>();

/** Garde uniquement les sources https plausibles (pas de placeholder « ... », pas de lien mort). */
function cleanSources(v: unknown): Source[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .map((s) => ({ type: str(s.type, 40), url: str(s.url, 500), title: str(s.title, 200) }))
    .filter((s) => !!s.url && /^https:\/\/[^\s/]+\.[^\s/]+\/?\S*$/.test(s.url) && !s.url.includes('...') && !DEAD_URLS.has(s.url));
}

function list<T>(v: unknown, map: (o: Json) => T | null): T[] {
  return Array.isArray(v) ? v.filter(isObj).map(map).filter((x): x is T => x !== null) : [];
}

export async function importEnrichment(
  prisma: PrismaClient,
  dir = path.resolve(__dirname, 'enrichment', 'out'),
): Promise<EnrichmentReport> {
  const report: EnrichmentReport = { files: 0, entries: 0, created: {}, skipped: [] };
  if (!fs.existsSync(dir)) return report;
  const deadPath = path.join(dir, '..', 'dead-urls.json');
  if (fs.existsSync(deadPath)) {
    DEAD_URLS = new Set(JSON.parse(fs.readFileSync(deadPath, 'utf-8')) as string[]);
  }
  // Garde-fou : seuls les lots contre-vérifiés (rapport verify/<LOT>.json, voir VERIFY.md)
  // sont importés. Un lot produit mais non vérifié n'atteint jamais la base.
  const verifyDir = path.join(dir, '..', 'verify');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .filter((f) => fs.existsSync(path.join(verifyDir, f)))
    .sort();

  const bump = (k: string) => (report.created[k] = (report.created[k] ?? 0) + 1);
  const skip = (id: number, why: string) => report.skipped.push(`[${id}] ${why}`);

  for (const file of files) {
    let entries: unknown;
    try {
      entries = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    } catch {
      report.skipped.push(`${file}: JSON invalide`);
      continue;
    }
    if (!Array.isArray(entries)) continue;
    report.files++;

    for (const e of entries) {
      if (!isObj(e) || typeof e.speciesId !== 'number') continue;
      const speciesId = e.speciesId;
      report.entries++;
      const profile = await prisma.speciesProfile.findUnique({
        where: { speciesId },
        select: { description: true, sourceUrl: true },
      });
      if (!profile) {
        skip(speciesId, 'fiche inexistante');
        continue;
      }
      const where = { speciesId_locale: { speciesId, locale: 'fr' } };

      // Description (uniquement si absente, et sourcée)
      const description = str(e.description, 500);
      const sourceUrl = str(e.sourceUrl, 500);
      if (description && !profile.description && sourceUrl?.startsWith('https://')) {
        await prisma.speciesProfile.update({
          where: { speciesId },
          data: { description, ...(profile.sourceUrl ? {} : { sourceUrl }) },
        });
        bump('description');
      }

      // Alimentation
      if (isObj(e.feeding) && !(await prisma.speciesFeeding.findUnique({ where }))) {
        const f = e.feeding;
        const foods = list(f.recommendedFoods, (o) =>
          str(o.name, 120) ? { name: str(o.name, 120), frequency: str(o.frequency, 60) ?? '', notes: str(o.notes, 300) } : null,
        );
        const avoid = list(f.foodsToAvoid, (o) =>
          str(o.name, 120) ? { name: str(o.name, 120), reason: str(o.reason, 300) ?? '' } : null,
        );
        const sources = cleanSources(f.sources);
        const dietType = str(f.dietType, 40);
        const meal = str(f.mealFrequency, 20);
        if (dietType && foods.length >= 2 && avoid.length >= 1 && sources.length && meal && MEAL_FREQ.includes(meal)) {
          await prisma.speciesFeeding.create({
            data: { speciesId, locale: 'fr', dietType, recommendedFoods: foods as never, foodsToAvoid: avoid as never, mealFrequency: meal, specificNeeds: str(f.specificNeeds), sources: sources as never },
          });
          bump('feeding');
        } else skip(speciesId, 'feeding invalide ou non sourcé');
      }

      // Habitat
      if (isObj(e.habitat) && !(await prisma.speciesHabitat.findUnique({ where }))) {
        const h = e.habitat;
        const sources = cleanSources(h.sources);
        const habitatType = str(h.habitatType, 20);
        const cost = str(h.costEstimate, 20);
        const tempMin = num(h.tempMin);
        const tempMax = num(h.tempMax);
        const minSpaceSize = str(h.minSpaceSize, 300);
        const lightNeeds = str(h.lightNeeds);
        const activityEnrichment = str(h.activityEnrichment);
        if (
          habitatType && HABITAT_TYPES.includes(habitatType) && cost && COST.includes(cost) &&
          tempMin !== null && tempMax !== null && tempMin <= tempMax && minSpaceSize && lightNeeds && activityEnrichment && sources.length
        ) {
          await prisma.speciesHabitat.create({
            data: { speciesId, locale: 'fr', habitatType, tempMin, tempMax, humidityMin: num(h.humidityMin), humidityMax: num(h.humidityMax), minSpaceSize, lightNeeds, activityEnrichment, hygieneNotes: str(h.hygieneNotes), costEstimate: cost, sources: sources as never },
          });
          bump('habitat');
        } else skip(speciesId, 'habitat invalide ou non sourcé');
      }

      // Comportement
      if (isObj(e.behavior) && !(await prisma.speciesBehavior.findUnique({ where }))) {
        const b = e.behavior;
        const sources = cleanSources(b.sources);
        const general = str(b.generalBehavior);
        const soc = str(b.sociability, 20);
        const diff = normDifficulty(str(b.difficultyLevel, 20));
        if (general && soc && SOCIABILITY.includes(soc) && diff && DIFFICULTY.includes(diff) && sources.length) {
          await prisma.speciesBehavior.create({
            data: { speciesId, locale: 'fr', generalBehavior: general, sociability: soc, difficultyLevel: diff, compatibilityWithChildren: str(b.compatibilityWithChildren), compatibilityWithOtherAnimals: str(b.compatibilityWithOtherAnimals), sources: sources as never },
          });
          bump('behavior');
        } else skip(speciesId, 'behavior invalide ou non sourcé');
      }

      // Santé
      if (isObj(e.health) && !(await prisma.speciesHealthContent.findUnique({ where }))) {
        const h = e.health;
        const sources = cleanSources(h.sources);
        const diseases = list(h.diseases, (o) =>
          str(o.name, 150)
            ? { name: str(o.name, 150), symptoms: str(o.symptoms, 400) ?? '', prevention: str(o.prevention, 400) ?? '', whenToConsult: str(o.whenToConsult, 300) ?? '' }
            : null,
        );
        if (diseases.length >= 1 && sources.length) {
          await prisma.speciesHealthContent.create({
            data: { speciesId, locale: 'fr', diseases: diseases as never, sources: sources as never },
          });
          bump('health');
        } else skip(speciesId, 'health invalide ou non sourcé');
      }

      // Législation (France)
      if (isObj(e.legislation)) {
        const l = e.legislation;
        const country = str(l.country, 2) ?? 'FR';
        const status = str(l.status, 20);
        const sources = cleanSources(l.sources);
        const exists = await prisma.speciesLegislation.findUnique({ where: { speciesId_country: { speciesId, country } } });
        if (!exists) {
          if (status && LEGAL_STATUS.includes(status) && sources.length) {
            const d = isObj(l.details) ? l.details : {};
            await prisma.speciesLegislation.create({
              data: {
                speciesId,
                country,
                status,
                details: {
                  citesAppendix: str(d.citesAppendix, 10) ?? null,
                  euAnnex: str(d.euAnnex, 10) ?? null,
                  permits: Array.isArray(d.permits) ? d.permits.filter((x) => typeof x === 'string').slice(0, 10) : [],
                  restrictions: Array.isArray(d.restrictions) ? d.restrictions.filter((x) => typeof x === 'string').slice(0, 10) : [],
                  // Contenu issu du pipeline d'enrichissement : statut légal à faire valider par un humain.
                  needsReview: true,
                } as never,
                sources: sources.map((s) => s.url as string),
              },
            });
            bump('legislation');
          } else skip(speciesId, 'legislation invalide ou non sourcée');
        }
      }

      // Reproduction
      if (isObj(e.reproduction) && !(await prisma.speciesReproduction.findUnique({ where }))) {
        const r = e.reproduction;
        const sources = cleanSources(r.sources);
        const diff = str(r.breedingDifficulty, 20);
        const hasData = [r.gestationDays, r.incubationDays, r.litterSizeMin, r.sexualMaturityMonths].some((v) => num(v) !== null) || !!str(r.season);
        if (hasData && sources.length && (!diff || BREEDING.includes(diff))) {
          await prisma.speciesReproduction.create({
            data: {
              speciesId,
              locale: 'fr',
              season: str(r.season, 120),
              gestationDays: int(r.gestationDays),
              incubationDays: int(r.incubationDays),
              litterSizeMin: int(r.litterSizeMin),
              litterSizeMax: int(r.litterSizeMax),
              sexualMaturityMonths: int(r.sexualMaturityMonths),
              breedingDifficulty: diff ?? null,
              notes: str(r.notes),
              sources: sources as never,
            },
          });
          bump('reproduction');
        } else skip(speciesId, 'reproduction invalide ou non sourcée');
      }
    }
  }
  return report;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  importEnrichment(prisma)
    .then((r) => {
      console.log(`📚 Enrichissement : ${r.files} lots, ${r.entries} fiches lues`, r.created);
      if (r.skipped.length) console.log(`⚠️  ${r.skipped.length} sections ignorées (non valides ou non sourcées)`);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
