#!/usr/bin/env node
/**
 * Build de l'app mobile (W6-02, D-11) : export statique Next.js dans `out/`, embarqué par Capacitor.
 *
 *   npm run build:mobile && npx cap sync
 *
 * Étapes (voir docs/MOBILE.md) :
 *  1. Écarte temporairement les fichiers serveur incompatibles avec `output: 'export'`
 *     (route API, middleware next-intl, catch-all 404 force-dynamic, layout SEO de species/[id]).
 *  2. Copie les overlays de `mobile/app/**` dans `src/app/**` (routes à query `detail?id=`,
 *     paramètres factices des routes dynamiques).
 *  3. `next build` avec MOBILE_BUILD=1 (next.config.ts → output: 'export', trailingSlash…).
 *  4. Restaure TOUJOURS l'arborescence (finally + signaux ; journal de reprise si le process est tué).
 *  5. Post-traitement de `out/` : `index.html` racine (amorce : redirection vers la locale, repli SPA
 *     de Capacitor), CSP en <meta> (MOB-16) et normalisation d'URL injectées dans chaque page.
 *
 *   node scripts/build-mobile.mjs --restore   # restaure après un build interrompu (kill -9…)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const OVERLAY_DIR = path.join(ROOT, 'mobile', 'app');
const APP_DIR = path.join(ROOT, 'src', 'app');
const JOURNAL = path.join(ROOT, 'mobile', '.build-journal.json');
/**
 * Sauvegarde des fichiers écartés : dans le dépôt (gitignoré), pas dans os.tmpdir() que le
 * système peut purger pendant un long build ou entre un kill -9 et la reprise.
 */
const STASH = path.join(ROOT, 'mobile', '.build-stash');

/** Fichiers web écartés le temps du build mobile (chemins relatifs à frontend/). */
const EXCLUDED = [
  'src/proxy.ts', // middleware next-intl : aucun serveur dans l'app (localePrefix 'always' + amorce)
  'src/app/api', // route handlers (dev uniquement)
  'src/app/[locale]/[...rest]', // catch-all 404 en force-dynamic
  'src/app/[locale]/species/[id]/layout.tsx', // métadonnées SEO via l'API → remplacé par l'overlay
  // Routes de métadonnées web (SEO / PWA) : sans objet dans l'app, et refusées par l'export
  // tant qu'elles ne déclarent pas `dynamic = 'force-static'`.
  'src/app/manifest.ts',
  'src/app/robots.ts',
  'src/app/sitemap.ts',
];

/** Routes dynamiques web → routes à query de l'app (miroir de src/lib/platform.ts). */
const DYNAMIC_ROUTES = [
  ['mes-animaux', '/mes-animaux/detail/', 'id'],
  ['species', '/species/', 'id'],
  ['animal-public', '/animal-public/', 'slug'],
];
const PLACEHOLDER_SEGMENT = '/_/';

const log = (msg) => console.log(`[build:mobile] ${msg}`);

function readLocales() {
  const src = fs.readFileSync(path.join(ROOT, 'i18n', 'routing.ts'), 'utf8');
  const locales = [...(src.match(/locales:\s*\[([^\]]+)\]/)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  const defaultLocale = src.match(/defaultLocale:\s*'([a-z-]+)'/)?.[1];
  if (!locales.length || !defaultLocale) throw new Error('Locales introuvables dans i18n/routing.ts');
  return { locales, defaultLocale };
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full) : [full];
  });
}

// --- 1/2/4 : préparation et restauration de l'arborescence -------------------------------------

function writeJournal(journal) {
  fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 2));
}

function restore() {
  if (!fs.existsSync(JOURNAL)) return false;
  const journal = JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
  for (const rel of [...journal.added].reverse()) {
    fs.rmSync(path.join(ROOT, rel), { recursive: true, force: true });
    // Supprime les dossiers devenus vides créés pour l'overlay.
    let dir = path.dirname(path.join(ROOT, rel));
    while (dir.startsWith(APP_DIR) && dir !== APP_DIR && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    }
  }
  const stash = journal.stash ?? STASH;
  const missing = [];
  for (const rel of journal.moved) {
    const backup = path.join(stash, rel);
    const target = path.join(ROOT, rel);
    if (!fs.existsSync(backup)) {
      // Déjà restauré (reprise après un arrêt en fin de restauration) : rien à faire.
      if (!fs.existsSync(target)) missing.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(backup, target, { recursive: true });
  }
  if (missing.length > 0) {
    // Échec bruyant : le journal et la sauvegarde restent en place pour une reprise manuelle.
    throw new Error(
      `[build:mobile] restauration impossible, sauvegarde absente pour : ${missing.join(', ')} ` +
        `(sauvegarde attendue dans ${path.relative(ROOT, stash)} ; récupérez ces fichiers avec git avant de relancer)`,
    );
  }
  // Journal d'abord : une sauvegarde orpheline (sans journal) est sans risque et purgée au build suivant.
  fs.rmSync(JOURNAL, { force: true });
  fs.rmSync(stash, { recursive: true, force: true });
  log('arborescence web restaurée');
  return true;
}

function prepare() {
  // Sans journal, une sauvegarde restante vient d'une restauration terminée : on la purge.
  fs.rmSync(STASH, { recursive: true, force: true });
  fs.mkdirSync(STASH, { recursive: true });
  const stash = STASH;
  const journal = { stash, moved: [], added: [] };
  writeJournal(journal);

  for (const rel of EXCLUDED) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    fs.cpSync(abs, path.join(stash, rel), { recursive: true });
    journal.moved.push(rel);
    writeJournal(journal); // journal à jour AVANT la suppression
    fs.rmSync(abs, { recursive: true, force: true });
  }

  for (const file of listFiles(OVERLAY_DIR)) {
    const rel = path.relative(ROOT, path.join(APP_DIR, path.relative(OVERLAY_DIR, file)));
    const target = path.join(ROOT, rel);
    if (fs.existsSync(target)) {
      throw new Error(`L'overlay ${rel} existe déjà dans src/app : ajoutez-le à EXCLUDED ou renommez-le.`);
    }
    journal.added.push(rel);
    writeJournal(journal);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  log(`${journal.moved.length} fichier(s) écarté(s), ${journal.added.length} overlay(s) ajouté(s)`);
}

// --- 5 : post-traitement de out/ ---------------------------------------------------------------

function originOf(raw, protocols) {
  try {
    const u = new URL((raw || '').trim());
    return protocols.includes(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}

/** CSP de l'app (MOB-16), alignée sur headers() de next.config.ts ; frame-ancestors est sans effet en <meta>. */
function buildCsp() {
  const api = originOf(process.env.NEXT_PUBLIC_API_URL, ['http:', 'https:']);
  const sentry = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN, ['https:']);
  if (!api) log('AVERTISSEMENT : NEXT_PUBLIC_API_URL absent ou invalide, connect-src limité à self');
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${["'self'", api, sentry].filter(Boolean).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Injecté en tête de chaque page : Capacitor sert `index.html` racine pour toute URL sans extension,
 * l'amorce recharge donc `/<locale>/<page>/index.html` ; on rétablit l'URL canonique
 * (`/<locale>/<page>/`) AVANT l'hydratation du routeur Next, et on mémorise la locale.
 */
const PAGE_SHIM =
  "(function(){try{var l=location,p=l.pathname;if(/\\/index\\.html$/.test(p)){p=p.slice(0,-10)||'/';" +
  "history.replaceState(history.state,'',p+l.search+l.hash)}var m=/^\\/([a-z]{2})(\\/|$)/.exec(p);" +
  "if(m)localStorage.setItem('captivia.locale',m[1])}catch(e){}})();";

function bootstrapHtml({ locales, defaultLocale, routes, csp }) {
  const script = `(function(){
var LOCALES=${JSON.stringify(locales)},DEF=${JSON.stringify(defaultLocale)},ROUTES=${JSON.stringify(routes)},DYN=${JSON.stringify(DYNAMIC_ROUTES)};
function pick(){try{var s=localStorage.getItem('captivia.locale');if(LOCALES.indexOf(s)>=0)return s}catch(e){}
var n=navigator.languages||[navigator.language||''];for(var i=0;i<n.length;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(LOCALES.indexOf(c)>=0)return c}return DEF}
var l=location,seg=l.pathname.split('/').filter(Boolean);if(seg[seg.length-1]==='index.html')seg.pop();
var loc=LOCALES.indexOf(seg[0])>=0?seg.shift():pick(),q=new URLSearchParams(l.search),rest='/'+seg.join('/')+(seg.length?'/':'');
if(seg.length===2&&ROUTES.indexOf(rest)<0){for(var j=0;j<DYN.length;j++){if(seg[0]===DYN[j][0]){try{q.set(DYN[j][2],decodeURIComponent(seg[1]))}catch(e){q.set(DYN[j][2],seg[1])}rest=DYN[j][1];break}}}
if(ROUTES.indexOf(rest)<0)rest='/';var s=q.toString();l.replace('/'+loc+rest+'index.html'+(s?'?'+s:'')+l.hash);
})();`;
  return `<!DOCTYPE html>
<html lang="${defaultLocale}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Captivia</title>
<style>html,body{margin:0;min-height:100%;background:#f4f7f2}</style>
<!-- Amorce de l'app (scripts/build-mobile.mjs) : / → /<locale>/, routes dynamiques → routes à query. -->
<script>${script}</script>
</head>
<body></body>
</html>
`;
}

function postProcess() {
  const { locales, defaultLocale } = readLocales();
  const missing = locales.filter((l) => !fs.existsSync(path.join(OUT, l, 'index.html')));
  if (missing.length) throw new Error(`Export incomplet : out/<locale>/index.html manquant pour ${missing.join(', ')}`);
  if (fs.existsSync(path.join(OUT, 'index.html'))) throw new Error('out/index.html existe déjà (route racine inattendue)');

  const csp = buildCsp();
  const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"/><script>${PAGE_SHIM}</script>`;
  const htmlFiles = listFiles(OUT).filter((f) => f.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    // Après la déclaration de charset (qui doit rester dans les 1 024 premiers octets), sinon après <head>.
    const anchor = html.match(/<meta charset="utf-8"\s*\/?>/i) ?? html.match(/<head>/i);
    if (!anchor) throw new Error(`<head> introuvable dans ${path.relative(ROOT, file)}`);
    const at = anchor.index + anchor[0].length;
    fs.writeFileSync(file, html.slice(0, at) + head + html.slice(at));
  }

  const localeRoot = path.join(OUT, defaultLocale);
  const routes = listFiles(localeRoot)
    .filter((f) => path.basename(f) === 'index.html')
    .map((f) => `/${path.relative(localeRoot, path.dirname(f)).split(path.sep).join('/')}/`.replace(/^\/\/$/, '/'))
    .filter((r) => !r.includes(PLACEHOLDER_SEGMENT))
    .sort();
  fs.writeFileSync(path.join(OUT, 'index.html'), bootstrapHtml({ locales, defaultLocale, routes, csp }));
  log(`${htmlFiles.length} page(s) HTML traitées, ${routes.length} route(s) par locale, amorce out/index.html écrite`);
}

// --- main ----------------------------------------------------------------------------------------

function main() {
  if (process.argv.includes('--restore')) {
    if (!restore()) log('rien à restaurer');
    return;
  }
  if (restore()) log('build précédent interrompu : restauration effectuée avant de reprendre');

  const onSignal = (sig) => {
    try {
      restore();
    } finally {
      process.exit(sig === 'SIGINT' ? 130 : 143);
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  let status = 1;
  try {
    prepare();
    fs.rmSync(OUT, { recursive: true, force: true });
    const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
    const res = spawnSync(process.execPath, [nextBin, 'build'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, MOBILE_BUILD: '1', NEXT_PUBLIC_MOBILE_BUILD: '1' },
    });
    status = res.status ?? 1;
  } finally {
    restore();
  }
  if (status !== 0) {
    console.error(`[build:mobile] échec de next build (code ${status})`);
    process.exit(status);
  }
  postProcess();
  log('terminé : lancez `npx cap sync` pour copier out/ dans les projets natifs');
}

main();
