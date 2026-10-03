#!/usr/bin/env node
/**
 * Contrôle des fiches store (W6-10) : `npm run store:check` (depuis frontend/).
 *
 * Lit docs/store/fiche-<langue>.md : chaque champ est un titre `### \`clé\` — …` suivi d'un bloc ```text.
 * Vérifie, en caractères Unicode :
 *   - les longueurs maximales des deux stores ;
 *   - les mots-clés iOS (virgules, sans espace, sans doublon, sans mot du titre ou du sous-titre) ;
 *   - la règle d'écriture (docs/PRODUCT.md, frontend/docs/DESIGN.md § 2) : pas de prix, d'émoji,
 *     de point d'exclamation ni de formule interdite.
 * Code de sortie 1 au moindre écart.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Longueur maximale par clé (App Store Connect et Play Console). */
const LIMITS = { title: 30, subtitle: 30, short: 80, promo: 170, keywords: 100, description: 4000, whatsnew: 500 };
const REQUIRED = Object.keys(LIMITS);

/** Formulations interdites (DESIGN.md § 2), par langue ; mots entiers, insensible à la casse. */
const BANNED = {
  fr: [
    'révolutionnaire', 'ultime', 'incroyable', 'magique', 'intelligent', 'découvrez', 'explorez', 'plongez',
    'en quelques clics', 'simplement', 'facilement', 'soigne', 'guérit', 'ia', 'assistant', 'débloquez',
    'offre limitée', 'veuillez', 'promesse', 'piliers', 'entonnoir',
  ],
  en: [
    'revolutionary', 'ultimate', 'incredible', 'amazing', 'magic', 'magical', 'smart', 'discover', 'explore',
    'dive into', 'in just a few clicks', 'simply', 'easily', 'cures', 'heals', 'ai', 'assistant', 'unlock',
    'limited offer', 'please',
  ],
};

const words = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const len = (text) => [...text].length;

function parse(file) {
  const source = readFileSync(file, 'utf8');
  const fields = {};
  const re = /^###\s+`(\w+)`[^\n]*\n[\s\S]*?```text\n([\s\S]*?)\n```/gm;
  for (let m = re.exec(source); m; m = re.exec(source)) fields[m[1]] = m[2];
  return fields;
}

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ECHEC  ${msg}`);
};

for (const lang of ['fr', 'en']) {
  const file = path.join(root, 'docs', 'store', `fiche-${lang}.md`);
  const fields = parse(file);
  console.log(`\n${path.relative(root, file)}`);
  for (const key of REQUIRED) {
    if (fields[key] === undefined) {
      fail(`champ « ${key} » absent`);
      continue;
    }
    const n = len(fields[key]);
    const ok = n <= LIMITS[key] && n > 0;
    console.log(`  ${ok ? 'ok    ' : 'ECHEC '} ${key.padEnd(12)} ${String(n).padStart(4)} / ${LIMITS[key]}`);
    if (!ok) failures += 1;
  }
  // Notes de version : l'App Store accepte 4 000 caractères, Google Play 500 ; on s'aligne sur le plus strict.

  const kw = fields.keywords ?? '';
  if (/\s/.test(kw)) fail('mots-clés : aucun espace ni retour à la ligne (virgules seules)');
  const list = kw.split(',').filter(Boolean);
  if (new Set(list.map((k) => k.toLowerCase())).size !== list.length) fail('mots-clés : doublon');
  const indexed = new Set([...words(fields.title ?? ''), ...words(fields.subtitle ?? '')]);
  for (const k of list) {
    if (words(k).some((w) => indexed.has(w) && w.length > 3)) fail(`mot-clé « ${k} » déjà indexé par le titre ou le sous-titre`);
  }

  for (const [key, text] of Object.entries(fields)) {
    for (const bad of BANNED[lang]) {
      if (words(text).includes(bad) || (bad.includes(' ') && text.toLowerCase().includes(bad))) {
        fail(`${key} : formulation interdite « ${bad} »`);
      }
    }
    if (/[€$£]|\b\d+\s?(eur|euros|usd)\b/i.test(text)) fail(`${key} : prix ou devise (aucun prix dans les fiches)`);
    if (/\p{Extended_Pictographic}/u.test(text)) fail(`${key} : émoji`);
    if (text.includes('!')) fail(`${key} : point d'exclamation`);
    if (/À COMPLÉTER|TO COMPLETE/.test(text)) fail(`${key} : marqueur à compléter`);
  }
}

console.log(failures === 0 ? '\nFiches store : OK' : `\nFiches store : ${failures} écart(s)`);
process.exit(failures === 0 ? 0 : 1);
