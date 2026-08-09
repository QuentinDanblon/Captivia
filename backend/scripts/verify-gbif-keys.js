// Vérification post-génération : chaque speciesId est re-résolu via
// GET /species/{key} et comparé au nom scientifique de l'entrée.
// Usage : node scripts/verify-gbif-keys.js [--fix]
const fs = require('fs');
const https = require('https');

const OUT = 'prisma/species-massive-data.ts';
const UA = 'Captivia/1.0 (https://captivia.com)';
const strRe = '"(?:[^"\\\\]|\\\\.)*"|undefined';

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/kl\.\s*/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const src = fs.readFileSync(OUT, 'utf8');
  const lines = src.split('\n').filter((l) => /^\s*\{\s*speciesId: \d+/.test(l));
  console.log(`Vérification de ${lines.length} clés GBIF...`);
  const problems = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(new RegExp(`speciesId: (\\d+), commonNameFr: (${strRe}), scientificName: (${strRe})`));
    if (!m) continue;
    const id = Number(m[1]);
    const sci = JSON.parse(m[2 + 1]);
    const genus = norm(sci).split(' ')[0];
    let data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      try { data = await getJson(`https://api.gbif.org/v1/species/${id}`); }
      catch (e) { await sleep(1500 * (attempt + 1)); }
    }
    await sleep(300);
    if (!data) { problems.push(`${id}\t${sci}\tINTROUVABLE`); continue; }
    const gotGenus = norm(data.scientificName || data.canonicalName || '').split(' ')[0];
    if (gotGenus !== genus) {
      problems.push(`${id}\t${sci}\t→ ${data.scientificName || data.canonicalName} (${data.rank}, ${data.taxonomicStatus})`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${lines.length}...`);
  }
  console.log(`\nANOMALIES: ${problems.length}`);
  for (const p of problems) console.log('  ', p);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
