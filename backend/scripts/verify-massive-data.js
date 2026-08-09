// Verification ponctuelle de species-massive-data.ts (non commité)
const fs = require('fs');
const src = fs.readFileSync('prisma/species-massive-data.ts', 'utf8');
const strRe = '"(?:[^"\\\\]|\\\\.)*"|undefined';
const lines = src.split('\n').filter((l) => /^\s*\{\s*speciesId: \d+/.test(l));
console.log('ENTRIES:', lines.length);
const ids = new Set();
let dup = 0, badDesc = 0, badUrl = 0, badEnum = 0, longDesc = 0, badId = 0;
const cats = new Set(['mammifère', 'oiseau', 'reptile', 'amphibien', 'poisson', 'insecte', 'arachnide']);
const doms = new Set(['domestique', 'semi-domestique', 'NAC']);
const entries = [];
for (const l of lines) {
  const m = l.match(
    new RegExp(
      `speciesId: (\\d+), commonNameFr: (${strRe}), scientificName: (${strRe}), category: (${strRe}), domesticationType: (${strRe}), description: (${strRe}), sourceUrl: (${strRe})`,
    ),
  );
  if (!m) { console.log('PARSE FAIL:', l.slice(0, 120)); continue; }
  const id = Number(m[1]);
  if (!Number.isInteger(id)) badId++;
  if (ids.has(id)) dup++;
  ids.add(id);
  const un = (s) => (s === 'undefined' ? undefined : JSON.parse(s));
  if (!cats.has(m[4].slice(1, -1))) badEnum++;
  if (!doms.has(m[5].slice(1, -1))) badEnum++;
  if (!un(m[6])) badDesc++;
  else if (un(m[6]).length > 500) longDesc++;
  if (!un(m[7])) badUrl++;
  entries.push({ id, fr: un(m[2]), sci: un(m[3]), cat: m[4].slice(1, -1), dom: m[5].slice(1, -1), desc: un(m[6]), url: un(m[7]) });
}
console.log(`ids non numériques: ${badId} | doublons: ${dup} | sans description: ${badDesc} | sans sourceUrl: ${badUrl} | enum invalides: ${badEnum} | desc>500: ${longDesc}`);
// 10 entrées au hasard
const rand = entries.slice().sort(() => Math.random() - 0.5).slice(0, 10);
for (const e of rand) {
  console.log('---', e.fr, '|', e.sci, '| id=' + e.id, '| cat=' + e.cat, '| dom=' + e.dom);
  console.log('   desc[' + (e.desc ? e.desc.length : 0) + ']:', e.desc ? e.desc.slice(0, 90) + '…' : '(aucune)');
  console.log('   url:', e.url || '(aucune)');
}
