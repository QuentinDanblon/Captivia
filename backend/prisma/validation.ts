/**
 * VALIDATION DES FICHES RACES — garde-fou de l'import (breeds-bulk.ts, import-breeds.ts,
 * import-enrichment.ts pour les races).
 *
 * Règle du dépôt (AGENTS.md § 2.4) : une donnée éditoriale est appuyée par une source réellement
 * consultée ; sans source, le champ reste null. Le contrôle des citations exactes se fait en
 * amont, dans le pipeline d'enrichissement (verify/<LOT>.json + enrichment/check_quotes.py, qui
 * télécharge les pages : impossible au moment du seed). Ce module refuse au moment de l'import :
 *  - une section sans source, ou dont une source est générique : titre d'un modèle
 *    `prisma/templates/*.json` (« Wamiz — guide lapin », « Wikipédia — page de référence
 *    (chien) »…) ou simple racine de site (https://wamiz.com) ;
 *  - une race dont la catégorie diffère de celle de son espèce parente ;
 *  - une alimentation dont le régime est incompatible avec l'espèce (modèle rongeur sur
 *    Felis catus) : régime différent de celui de l'espèce parente, ou hors des régimes connus du
 *    genre.
 */
import * as fs from 'fs';
import * as path from 'path';

export const BREED_SECTIONS = ['feeding', 'habitat', 'behavior', 'health', 'legislation', 'reproduction'] as const;
export type BreedSection = (typeof BREED_SECTIONS)[number];

export interface SourceLike {
  type?: string;
  url?: string;
  title?: string;
}

/** Titres des sources des modèles éditoriaux par espèce (prisma/templates/*.json). */
export function loadTemplateSourceTitles(dir = path.resolve(__dirname, 'templates')): Set<string> {
  const titles = new Set<string>();
  if (!fs.existsSync(dir)) return titles;
  for (const file of fs.readdirSync(dir)) {
    if (!file.startsWith('template-') || !file.endsWith('.json')) continue;
    const template = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Record<string, unknown>;
    for (const section of BREED_SECTIONS) {
      const sources = (template[section] as { sources?: SourceLike[] } | null | undefined)?.sources;
      for (const s of sources ?? []) if (s?.title) titles.add(s.title);
    }
  }
  return titles;
}

let templateTitles: Set<string> | undefined;
function templateSourceTitles(): Set<string> {
  templateTitles ??= loadTemplateSourceTitles();
  return templateTitles;
}

/** Source générique : URL non https, racine de site, ou source d'un modèle éditorial. */
export function isGenericSource(source: SourceLike, titles: Set<string> = templateSourceTitles()): boolean {
  if (source.title && titles.has(source.title)) return true;
  if (source.title && /page de référence/i.test(source.title)) return true;
  let url: URL;
  try {
    url = new URL(String(source.url ?? ''));
  } catch {
    return true;
  }
  if (url.protocol !== 'https:') return true;
  return url.pathname === '' || url.pathname === '/';
}

/** Erreurs de sourçage d'une section (liste vide = section acceptable). */
export function checkSectionSources(
  section: BreedSection,
  value: { sources?: unknown } | null | undefined,
  titles?: Set<string>,
): string[] {
  if (value === null || value === undefined) return [];
  const sources = Array.isArray(value.sources) ? (value.sources as SourceLike[]) : [];
  if (sources.length === 0) return [`${section} : aucune source`];
  const generic = sources.filter((s) => isGenericSource(s, titles));
  if (generic.length > 0) {
    return [`${section} : source générique (${generic.map((s) => s.title || s.url).join(', ')})`];
  }
  return [];
}

/**
 * Régimes connus par genre (espèces domestiques dont les races sont importées). Un régime hors
 * de cette liste signale une section recopiée d'un autre animal.
 */
const DIETS_BY_GENUS: Record<string, string[]> = {
  felis: ['carnivore'],
  canis: ['carnivore', 'omnivore'],
  mustela: ['carnivore'],
  oryctolagus: ['herbivore'],
  cavia: ['herbivore'],
  chinchilla: ['herbivore'],
  equus: ['herbivore'],
  bos: ['herbivore'],
  ovis: ['herbivore'],
  capra: ['herbivore'],
  testudo: ['herbivore'],
  sus: ['omnivore'],
  gallus: ['omnivore', 'granivore'],
  meleagris: ['omnivore', 'granivore'],
  anas: ['omnivore'],
  cairina: ['omnivore'],
  columba: ['granivore'],
};

function normDiet(diet: string): string {
  return diet.trim().toLowerCase().replace(/^graivor(e)?$/, 'granivore');
}

/** Erreur si le régime d'une alimentation est incompatible avec l'espèce (null = compatible). */
export function checkDietCompatibility(
  scientificName: string,
  dietType: string | undefined,
  parentDietType?: string | null,
): string | null {
  if (!dietType) return null;
  const diet = normDiet(dietType);
  if (parentDietType && normDiet(parentDietType) !== diet) {
    return `feeding : régime « ${dietType} » incompatible avec l'espèce parente (« ${parentDietType} »)`;
  }
  const genus = scientificName.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const allowed = DIETS_BY_GENUS[genus];
  if (allowed && !allowed.includes(diet)) {
    return `feeding : régime « ${dietType} » incompatible avec ${scientificName}`;
  }
  return null;
}

export interface ParentInfo {
  category: string;
  dietType?: string | null;
}

/** Entrée de breeds-data.json (champs lus ici). */
export interface BreedEntryLike {
  speciesId: number;
  commonNameFr: string;
  scientificName: string;
  category: string;
  feeding?: { dietType?: string; sources?: unknown } | null;
  habitat?: { sources?: unknown } | null;
  behavior?: { sources?: unknown } | null;
  health?: { sources?: unknown } | null;
  legislation?: { sources?: unknown } | null;
  reproduction?: { sources?: unknown } | null;
}

/**
 * Erreurs d'une fiche race : catégorie différente de l'espèce parente, sections non sourcées ou
 * génériques, régime incompatible. Une section null est toujours acceptée (rien n'est importé).
 */
export function validateBreedEntry(entry: BreedEntryLike, parent?: ParentInfo | null, titles?: Set<string>): string[] {
  const label = `[${entry.speciesId}] ${entry.commonNameFr}`;
  const errors: string[] = [];
  if (parent && parent.category !== entry.category) {
    errors.push(`catégorie « ${entry.category} » différente de l'espèce parente (« ${parent.category} »)`);
  }
  for (const section of BREED_SECTIONS) {
    errors.push(...checkSectionSources(section, entry[section], titles));
  }
  const dietError = checkDietCompatibility(entry.scientificName, entry.feeding?.dietType, parent?.dietType);
  if (entry.feeding && dietError) errors.push(dietError);
  return errors.map((e) => `${label}: ${e}`);
}
