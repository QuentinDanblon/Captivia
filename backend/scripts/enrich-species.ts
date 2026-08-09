/**
 * ENRICH-SPECIES — Pipeline sourcé d'enrichissement des profils d'espèces.
 *
 * Source des données (règle d'or : AUCUNE donnée non sourcée) :
 *  - speciesId      : nubKey GBIF résolue via l'API GBIF (https://api.gbif.org/v1/species/search)
 *  - description    : extract Wikipedia FR (REST summary), jamais inventé
 *  - sourceUrl      : URL de la page Wikipedia FR d'où provient la description
 *  - commonNameFr   : nom FR de la liste cible (species-target-list.py)
 *
 * Sortie : prisma/species-massive-data.ts (format identique à species-data.ts,
 * plus le champ sourceUrl pour la traçabilité de chaque description).
 * Journal : <os.tmpdir()>/enrich-log.txt — une ligne par espèce (ok/miss/skip).
 *
 * Robustesse : timeout 15 s, 2 retries sur erreur réseau, sleep 0,3 s entre
 * requêtes GBIF (politesse), écriture incrémentale du fichier de sortie
 * (reprise possible : les espèces déjà présentes dans le fichier sont sautées).
 *
 * Usage : depuis backend/ : npx ts-node scripts/enrich-species.ts
 */
import axios from 'axios';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const UA = 'Captivia/1.0 (https://captivia.com)';
const GBIF_BASE = 'https://api.gbif.org/v1';
const WIKI_BASE = 'https://fr.wikipedia.org/api/rest_v1/page/summary';

const OUT_FILE = path.resolve(__dirname, '../prisma/species-massive-data.ts');
const LOG_FILE = path.join(os.tmpdir(), 'enrich-log.txt');
const TARGET_LIST_FILE = path.resolve(__dirname, '../prisma/species-target-list.py');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Classification structurelle (documentée — choix éditorial Captivia)
// ---------------------------------------------------------------------------
// category : les valeurs de SpeciesProfile sont les catégories FR du projet
// ('mammifère', 'reptile', 'amphibien', 'oiseau', 'poisson', 'insecte',
// 'arachnide' — voir seed-prod.ts / schema.prisma). Les classes de la liste
// cible (mammal/bird/reptile/amphibian/fish/invertebrate) sont mappées ainsi ;
// pour les invertébrés, les arachnides (mygales, scorpions) → 'arachnide',
// les autres (phasmes, mantes, blattes, gastéropodes, crustacés…) → 'insecte'.
const CATEGORY_MAP: Record<string, string> = {
  mammal: 'mammifère',
  bird: 'oiseau',
  reptile: 'reptile',
  amphibian: 'amphibien',
  fish: 'poisson',
  invertebrate: 'insecte',
};

const ARACHNID_SCINAMES = new Set([
  'Grammostola rosea',
  'Brachypelma smithi',
  'Brachypelma auratum',
  'Avicularia avicularia',
  'Theraphosa blondi',
  'Lasiodora parahybana',
  'Cyriopagopus lividus',
  'Pandinus imperator',
  'Androctonus australis',
  'Buthus occitanus',
  'Euscorpius italicus',
]);

// domesticationType : l'enum du projet est ['domestique', 'semi-domestique',
// 'NAC'] (pas de valeur 'exotique' — le brief « exotique » est couvert par
// 'NAC' = Nouveaux Animaux de Compagnie). Règle structurelle :
//  - 'domestique' : espèces de compagnie / basse-cour / élevage classiques
//    (chien, chat, furet, rongeurs de compagnie, oiseaux de volière classiques,
//    volailles, poissons d'aquarium domestiqués, etc.) — liste explicite ci-dessous ;
//  - 'NAC' : toutes les autres (reptiles, amphibiens, invertébrés, mammifères
//    sauvages maintenus en captivité, oiseaux exotiques).
const DOMESTIC_SCINAMES = new Set([
  // Mammifères domestiques classiques
  'Canis lupus familiaris', 'Felis catus', 'Mustela putorius furo',
  'Oryctolagus cuniculus', 'Cavia porcellus',
  'Mesocricetus auratus', 'Phodopus sungorus', 'Phodopus campbelli', 'Phodopus roborovskii',
  'Rattus norvegicus', 'Mus musculus', 'Meriones unguiculatus',
  'Chinchilla lanigera', 'Octodon degus',
  'Sus scrofa domesticus', 'Capra aegagrus hircus', 'Ovis aries', 'Bos taurus',
  'Equus ferus caballus', 'Equus asinus', 'Vicugna pacos', 'Lama glama',
  // Oiseaux de volière / basse-cour classiques
  'Melopsittacus undulatus', 'Nymphicus hollandicus', 'Serinus canaria',
  'Taeniopygia guttata', 'Lonchura striata domestica', 'Lonchura oryzivora',
  'Lonchura punctulata', 'Estrilda caerulescens',
  'Streptopelia risoria', 'Columba livia domestica',
  'Gallus gallus domesticus', 'Anas platyrhynchos', 'Anser anser domesticus',
  'Meleagris gallopavo', 'Coturnix japonica',
  'Chrysolophus pictus', 'Chrysolophus amherstiae', 'Pavo cristatus', 'Cygnus olor',
  // Poissons d'aquarium domestiqués
  'Carassius auratus', 'Cyprinus rubrofuscus',
  'Poecilia reticulata', 'Poecilia latipinna', 'Xiphophorus maculatus', 'Xiphophorus hellerii',
  'Danio rerio', 'Betta splendens', 'Pterophyllum scalare', 'Symphysodon discus',
  // Invertébrés domestiqués (élevés en aquarium/terrarium depuis des décennies)
  'Neocaridina davidi',
]);

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalize = (s: string) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/kl\.\s*/g, '') // marqueur d'hybride (ex: Pelophylax kl. esculentus)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const firstTwo = (s: string) => normalize(s).split(' ').slice(0, 2).join(' ');

// ---------------------------------------------------------------------------
// 1. Chargement de la liste cible (291 espèces) — python3 (fallback : parse)
// ---------------------------------------------------------------------------
interface TargetSpecies {
  class: string;
  fr: string;
  sci: string;
}

function loadTargetSpecies(): TargetSpecies[] {
  try {
    // Statements séparés par ';' : execSync passe l'argument tel quel (les \n
    // littéraux casseraient la syntaxe python avec -c).
    const pyScript =
      `import importlib.util, json; ` +
      `spec = importlib.util.spec_from_file_location('stl', ${JSON.stringify(TARGET_LIST_FILE)}); ` +
      `m = importlib.util.module_from_spec(spec); ` +
      `spec.loader.exec_module(m); ` +
      `print(json.dumps(m.TARGET_SPECIES, ensure_ascii=False))`;
    const out = execSync(`python3 -c ${JSON.stringify(pyScript)}`, { encoding: 'utf8', timeout: 30000 });
    const parsed = JSON.parse(out.trim().split('\n').pop()!);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.warn('[enrich] python3 indisponible, fallback parse regex:', (e as Error).message.split('\n')[0]);
  }
  // Fallback : parse direct du fichier Python (gère quotes simples/doubles et échappements)
  const src = fs.readFileSync(TARGET_LIST_FILE, 'utf8');
  const body = src.match(/TARGET_SPECIES\s*=\s*\[([\s\S]*)\]/);
  if (!body) throw new Error('TARGET_SPECIES introuvable dans species-target-list.py');
  const items: TargetSpecies[] = [];
  const unquote = (s: string) => {
    if (s.startsWith('"')) return JSON.parse(s);
    return s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  };
  const re = /\{\s*'class':\s*'([^']+)',\s*'fr':\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),\s*'sci':\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body[1]))) {
    items.push({ class: m[1], fr: unquote(m[2]), sci: unquote(m[3]) });
  }
  if (items.length === 0) throw new Error('Aucune espèce parsée');
  return items;
}

// ---------------------------------------------------------------------------
// 2. Espèces déjà couvertes (species-data.ts + batch-2 + extended) — skip
// ---------------------------------------------------------------------------
function loadExistingCoverage() {
  const keys = new Set<number>();
  const firstTwos = new Set<string>();
  const names = new Set<string>();
  const dir = path.resolve(__dirname, '../prisma');
  for (const f of ['species-data.ts', 'batch-2-species-data.ts', 'extended-species-data.ts']) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /speciesId:\s*(\d+)[\s\S]*?scientificName:\s*'([^']+)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      keys.add(Number(m[1]));
      names.add(normalize(m[2]));
      firstTwos.add(firstTwo(m[2]));
    }
  }
  return { keys, names, firstTwos };
}

// Formes domestiques dont le nom diffère du profil existant (même espèce) :
// 'Canis lupus familiaris' ≡ profil 'Canis familiaris' (5287871),
// 'Equus ferus caballus'   ≡ profil 'Equus caballus' (5288995).
const ALIAS_SKIP = new Set(['canis lupus familiaris', 'equus ferus caballus']);

// ---------------------------------------------------------------------------
// 3. HTTP robuste
// ---------------------------------------------------------------------------
const http = axios.create({ timeout: 15000, headers: { 'User-Agent': UA } });

async function getJson(url: string, params?: Record<string, unknown>, retries = 2): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await http.get(url, { params });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) return null; // pas de retry sur 404
      if (status === 429) {
        await sleep(3000); // rate limit : pause plus longue
      }
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. Résolution GBIF nubKey
// ---------------------------------------------------------------------------
async function resolveGbifKey(sci: string, fr: string): Promise<{ key: number; matchedName: string } | null> {
  const q = normalize(sci);
  const attempts: Array<{ q: string; rank?: string }> = [
    { q, rank: 'SPECIES' },
    { q }, // sans filtre de rang (sous-espèces/variétés : formes domestiques…)
  ];
  for (const a of attempts) {
    const data = await getJson(`${GBIF_BASE}/species/search`, { q: a.q, limit: 5, rank: a.rank });
    const results: any[] = data?.results || [];
    if (results.length === 0) continue;
    // Score : la correspondance de NOM est obligatoire (le statut/le rang ne
    // suffisent jamais — sinon des parasites/taxons sans rapport peuvent
    // remonter, ex. 'Amblyomma mixtum' pour 'Sus scrofa domesticus').
    const scored = results
      .map((r) => {
        const cn = normalize(r.canonicalName || r.scientificName || '');
        const sn = normalize(r.scientificName || '');
        let nameScore = 0;
        if (cn === q) nameScore += 100;
        if (sn === q) nameScore += 100;
        if (sn.startsWith(q) || q.startsWith(sn)) nameScore += 40;
        if (firstTwo(sn || cn) === firstTwo(sci)) nameScore += 30;
        let bonus = 0;
        if (r.taxonomicStatus === 'ACCEPTED') bonus += 20;
        if (r.rank === 'SPECIES') bonus += 10;
        else if (r.rank === 'SUBSPECIES' || r.rank === 'VARIETY' || r.rank === 'FORM') bonus += 6;
        return { r, nameScore, bonus };
      })
      .filter((x) => x.nameScore >= 30) // exigence : correspondance de nom réelle
      .sort((x, y) => y.nameScore - x.nameScore || y.bonus - x.bonus);
    const best = scored[0];
    if (best) {
      // nubKey = clé du backbone GBIF (identifiant stable) ; `key` = clé du
      // jeu de données sous-jacent. Le projet utilise des nubKeys (ex: 5221172).
      return {
        key: best.r.nubKey || best.r.key,
        matchedName: best.r.scientificName || best.r.canonicalName || '',
      };
    }
  }
  // Dernier essai : nom commun FR (avec garde : le genre doit correspondre)
  const data = await getJson(`${GBIF_BASE}/species/search`, { q: fr, limit: 5, rank: 'SPECIES' });
  const genus = normalize(sci).split(' ')[0];
  const frHit = (data?.results || []).find(
    (r: any) => normalize(r.canonicalName || r.scientificName || '').split(' ')[0] === genus,
  );
  if (frHit && (frHit.nubKey || frHit.key)) {
    return { key: frHit.nubKey || frHit.key, matchedName: frHit.scientificName || frHit.canonicalName || '' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Wikipedia FR (REST summary + fallback recherche MediaWiki)
// ---------------------------------------------------------------------------
async function searchWikipedia(title: string): Promise<string | null> {
  const data = await getJson('https://fr.wikipedia.org/w/api.php', {
    action: 'query',
    list: 'search',
    srsearch: title,
    srlimit: 1,
    format: 'json',
    origin: '*',
  });
  const hit = data?.query?.search?.[0]?.title;
  return typeof hit === 'string' && hit.length > 0 ? hit : null;
}

async function fetchWikipedia(title: string): Promise<{ description?: string; sourceUrl?: string }> {
  const tryTitle = async (t: string) => {
    const data = await getJson(`${WIKI_BASE}/${encodeURIComponent(t)}`);
    if (!data) return null;
    return {
      extract: typeof data.extract === 'string' && data.extract.length > 0 ? data.extract : null,
      pageUrl: data.content_urls?.desktop?.page || null,
    };
  };
  let res = await tryTitle(title); // titre = nom scientifique
  if (!res) res = await tryTitle(title.toLowerCase());
  if (!res) {
    // Fallback : recherche MediaWiki (l'article existe sous un titre différent)
    const found = await searchWikipedia(title);
    if (found) res = await tryTitle(found);
  }
  if (!res) return {};
  let description: string | undefined;
  if (res.extract) {
    const cleaned = res.extract.replace(/\s+/g, ' ').trim();
    const chars = Array.from(cleaned);
    description = chars.length > 500 ? chars.slice(0, 497).join('').trimEnd() + '…' : cleaned;
  }
  return { description, sourceUrl: res.pageUrl || undefined };
}

// ---------------------------------------------------------------------------
// 6. Écriture du fichier de sortie (format des fichiers existants)
// ---------------------------------------------------------------------------
interface ProfileEntry {
  speciesId: number;
  commonNameFr: string;
  scientificName: string;
  category: string;
  domesticationType: string;
  description?: string;
  sourceUrl?: string;
}

function writeOutput(entries: ProfileEntry[], done: Set<string>) {
  const lines = [
    '// GENERATED by scripts/enrich-species.ts — NE PAS MODIFIER À LA MAIN.',
    '// Pipeline sourcé : speciesId = nubKey GBIF (api.gbif.org), description = extract',
    '// Wikipedia FR (sourceUrl = page source), commonNameFr = liste cible.',
    '// category : catégories FR du projet (mammifère/oiseau/reptile/amphibien/',
    '// poisson/insecte/arachnide — invertébrés arachnides → arachnide, sinon insecte).',
    '// domesticationType : \'domestique\' pour les espèces de compagnie/basse-cour/',
    '// élevage classiques (liste explicite dans enrich-species.ts), \'NAC\' sinon',
    '// (l\'enum du projet n\'a pas de valeur \'exotique\' ; NAC = Nouveaux Animaux de Compagnie).',
    'export const MASSIVE_SPECIES_DATABASE: Array<{',
    '  speciesId: number;',
    '  commonNameFr: string;',
    '  scientificName: string;',
    '  category: string;',
    '  subcategory?: string;',
    '  domesticationType: string;',
    '  description?: string;',
    '  sourceUrl?: string;',
    '}> = [',
  ];
  for (const e of entries) {
    lines.push(
      `  { speciesId: ${e.speciesId}, commonNameFr: ${JSON.stringify(e.commonNameFr)}, scientificName: ${JSON.stringify(
        e.scientificName,
      )}, category: ${JSON.stringify(e.category)}, domesticationType: ${JSON.stringify(
        e.domesticationType,
      )}, description: ${e.description ? JSON.stringify(e.description) : 'undefined'}, sourceUrl: ${
        e.sourceUrl ? JSON.stringify(e.sourceUrl) : 'undefined'
      } },`,
    );
  }
  lines.push('];');
  lines.push('');
  lines.push(`// ${entries.length} profils générés le ${new Date().toISOString()} — ${done.size} espèces traitées.`);
  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
}

/** Relit les entrées déjà écrites (reprise) : retourne la liste et les noms traités. */
function loadDoneFromOutput(): { done: Set<string>; entries: ProfileEntry[] } {
  const done = new Set<string>();
  const entries: ProfileEntry[] = [];
  if (!fs.existsSync(OUT_FILE)) return { done, entries };
  const src = fs.readFileSync(OUT_FILE, 'utf8');
  const str = (s?: string) =>
    s && s !== 'undefined'
      ? s.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : undefined;
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*\{\s*speciesId:\s*(\d+)(.*)\},?\s*$/);
    if (!m) continue;
    const body = m[2];
    const get = (field: string) => {
      const f = body.match(new RegExp(`${field}:\\s*("(?:[^"\\\\]|\\\\.)*"|undefined)`));
      return f ? str(f[1]) : undefined;
    };
    const sci = get('scientificName');
    if (!sci) continue;
    entries.push({
      speciesId: Number(m[1]),
      commonNameFr: get('commonNameFr') || '',
      scientificName: sci,
      category: get('category') || '',
      domesticationType: get('domesticationType') || '',
      description: get('description'),
      sourceUrl: get('sourceUrl'),
    });
    done.add(normalize(sci));
  }
  // Déduplication par speciesId (deux noms cibles peuvent résoudre la même
  // nubKey, ex. 'Lampropeltis triangulum' et 'L. t. hondurensis') : on garde
  // l'entrée canonique (nom scientifique le plus court).
  const byKey = new Map<number, number>(); // speciesId -> index
  for (let i = 0; i < entries.length; i++) {
    const prev = byKey.get(entries[i].speciesId);
    if (prev === undefined) {
      byKey.set(entries[i].speciesId, i);
    } else {
      const keep = entries[prev].scientificName.split(' ').length <= entries[i].scientificName.split(' ').length ? prev : i;
      const drop = keep === prev ? i : prev;
      console.warn(`[enrich] dédoublonnage reprise: ${entries[drop].scientificName} (id ${entries[drop].speciesId}) fusionné dans ${entries[keep].scientificName}`);
      entries.splice(drop, 1);
      byKey.set(entries[keep].speciesId, keep < drop ? keep : keep - 1);
      i--;
    }
  }
  return { done, entries };
}

function log(line: string) {
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  console.log(line);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  fs.appendFileSync(LOG_FILE, `\n=== enrich-species ${new Date().toISOString()} ===\n`, 'utf8');

  const targets = loadTargetSpecies();
  const existing = loadExistingCoverage();
  const { done, entries: previousEntries } = loadDoneFromOutput();
  console.log(`[enrich] ${targets.length} espèces cibles, ${existing.keys.size} clés existantes, ${done.size} déjà dans le fichier de sortie`);

  const entries: ProfileEntry[] = [...previousEntries];
  const writtenKeys = new Set<number>(entries.map((e) => e.speciesId));
  let okCount = 0;
  let missCount = 0;
  let skipCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const norm = normalize(t.sci);

    // Reprise : déjà écrit dans le fichier de sortie ?
    if (done.has(norm)) {
      skipCount++;
      log(`skip\t-\t${t.sci}\t${t.fr}\tresume (déjà dans species-massive-data.ts)`);
      continue;
    }
    // Déjà couvert par un profil existant ?
    if (ALIAS_SKIP.has(norm) || existing.firstTwos.has(firstTwo(t.sci))) {
      skipCount++;
      log(`skip\t-\t${t.sci}\t${t.fr}\tprofil existant (species-data.ts/batch-2/extended)`);
      continue;
    }

    // a) Résolution GBIF nubKey
    let resolved: { key: number; matchedName: string } | null = null;
    try {
      resolved = await resolveGbifKey(t.sci, t.fr);
    } catch (e: any) {
      log(`miss\t-\t${t.sci}\t${t.fr}\terr réseau: ${e?.message || e}`);
      missCount++;
      continue;
    }
    await sleep(300); // politesse GBIF

    if (!resolved) {
      missCount++;
      log(`miss\t-\t${t.sci}\t${t.fr}\tnubKey GBIF non résolue`);
      continue;
    }
    // b) La nubKey existe déjà en base ?
    if (existing.keys.has(resolved.key)) {
      skipCount++;
      log(`skip\t${resolved.key}\t${t.sci}\t${t.fr}\tnubKey ${resolved.key} déjà présente`);
      continue;
    }
    // Déduplication : nubKey déjà écrite dans ce fichier (ex. sous-espèce résolue
    // sur la nubKey de l'espèce) ?
    if (writtenKeys.has(resolved.key)) {
      skipCount++;
      log(`skip\t${resolved.key}\t${t.sci}\t${t.fr}\tnubKey ${resolved.key} déjà écrite (même taxon)`);
      continue;
    }

    // c) Wikipedia FR
    let wiki: { description?: string; sourceUrl?: string } = {};
    try {
      wiki = await fetchWikipedia(t.sci);
      if (!wiki.description && t.fr !== t.sci) wiki = await fetchWikipedia(t.fr);
      await sleep(100);
    } catch (e: any) {
      log(`ok\t${resolved.key}\t${t.sci}\t${t.fr}\twiki err (description absente): ${e?.message || e}`);
      wiki = {};
    }

    // d) Nom commun FR : liste cible (fallback vernacular GBIF si absent — jamais le cas ici)
    let commonNameFr = t.fr;
    if (!commonNameFr) {
      try {
        const verns = await getJson(`${GBIF_BASE}/species/${resolved.key}/vernacularNames`);
        const fra = (verns?.results || []).find((v: any) => v.language === 'fra');
        commonNameFr = fra?.vernacularName || '';
        await sleep(300);
      } catch {
        commonNameFr = '';
      }
    }

    const category =
      t.class === 'invertebrate'
        ? ARACHNID_SCINAMES.has(t.sci)
          ? 'arachnide'
          : 'insecte'
        : CATEGORY_MAP[t.class] || 'insecte';
    const domesticationType = DOMESTIC_SCINAMES.has(t.sci) ? 'domestique' : 'NAC';

    entries.push({
      speciesId: resolved.key,
      commonNameFr,
      scientificName: t.sci,
      category,
      domesticationType,
      description: wiki.description,
      sourceUrl: wiki.sourceUrl,
    });
    writtenKeys.add(resolved.key);
    okCount++;
    log(`ok\t${resolved.key}\t${t.sci}\t${t.fr}\t${wiki.sourceUrl || 'sans source wiki'}${resolved.matchedName ? ` (gbif: ${resolved.matchedName})` : ''}`);

    // Écriture incrémentale (reprise possible si interruption)
    if (okCount % 10 === 0) {
      writeOutput(entries, done);
      console.log(`[enrich] progression ${i + 1}/${targets.length} — ${okCount} ok, ${missCount} miss, ${skipCount} skip`);
    }
  }

  writeOutput(entries, done);
  console.log(`\n[enrich] TERMINÉ : ${okCount} ok, ${missCount} miss, ${skipCount} skip (total ${targets.length})`);
  console.log(`[enrich] Fichier : ${OUT_FILE}`);
  console.log(`[enrich] Journal : ${LOG_FILE}`);
}

main().catch((e) => {
  console.error('[enrich] FATAL:', e);
  process.exit(1);
});
