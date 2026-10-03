#!/usr/bin/env node
/**
 * Sources graphiques des applications mobiles (W6-10, MOB-02) — LOGO PROVISOIRE (décision D-15).
 *
 * Produit, de façon reproductible, les fichiers attendus par `@capacitor/assets` :
 *   mobile/assets/icon-only.png        1024², opaque, plein cadre (icône iOS, Play Store)
 *   mobile/assets/icon-foreground.png  1024², transparent, motif dans la zone sûre (adaptatif Android)
 *   mobile/assets/icon-background.png  1024², aplat mousse (adaptatif Android)
 *   mobile/assets/splash.png           2732², papier clair
 *   mobile/assets/splash-dark.png      2732², encre sombre
 *   mobile/assets/store/play-icon-512.png   512², icône haute résolution de la Play Console
 * et l'icône de notification Android (silhouette blanche, fond transparent) :
 *   mobile/android-template/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_stat_captivia.png
 *
 * Le motif est celui de `public/brand/captivia-mark.svg` (feuille + pastille), recoloré avec les
 * jetons de la direction artistique (`frontend/docs/DESIGN.md` § 3.1) : mousse, papier, encre.
 * Quand le designer livre le logo maître 1024×1024 : remplacer LEAF_* ci-dessous (ou déposer ses
 * PNG dans mobile/assets/ et ne pas relancer ce script), puis relancer `npm run assets:mobile`.
 *
 * Usage (depuis frontend/) :
 *   npm run assets:mobile:sources     # écrit les PNG ci-dessus
 *   npm run assets:mobile             # puis, APRÈS `npx cap add android|ios` : génère les ressources natives
 *
 * Dépendance : `sharp` (déjà présent dans node_modules, installé par Next.js).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('[assets] `sharp` est introuvable : lancez `npm ci` (ou `npm i -D sharp`) dans frontend/.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'mobile', 'assets');
const resDir = path.join(root, 'mobile', 'android-template', 'res');

/** Jetons de la direction artistique (DESIGN.md § 3.1). */
const TOKEN = {
  paper: '#F6F3EC',
  onAccent: '#FFFDF8',
  accent: '#2F5D46', // mousse (clair)
  accentDark: '#8CC5A2', // mousse (sombre)
  inkDark: '#121714', // papier sombre
  amber: '#E7A64B', // pastille du logo provisoire
};

/** Géométrie du logo provisoire (viewBox 1024 × 1024, public/brand/captivia-mark.svg). */
const LEAF_PATH =
  'M512 232C712 292 788 468 740 640C700 780 584 832 512 792C440 832 324 780 284 640C236 468 312 292 512 232Z';
const VEIN_MIDRIB = 'M512 330V790';
const VEIN_SIDES =
  'M512 520C456 508 410 470 384 420M512 620C450 608 400 568 372 516M512 520C568 508 614 470 640 420M512 620C574 608 624 568 652 516';
const DOT = { cx: 742, cy: 282, r: 48 };

/** Motif complet, centré sur (512, 512) puis réduit de `scale`. */
function mark({ leaf, vein, dot, scale = 1 }) {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `<g transform="${t}">
    <path d="${LEAF_PATH}" fill="${leaf}"/>
    <path d="${VEIN_MIDRIB}" stroke="${vein}" stroke-width="34" stroke-linecap="round" fill="none"/>
    <path d="${VEIN_SIDES}" stroke="${vein}" stroke-width="26" stroke-linecap="round" fill="none"/>
    ${dot ? `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${dot}"/>` : ''}
  </g>`;
}

const svg = (size, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`);

const png = (buffer) => sharp(buffer).png({ compressionLevel: 9 });

async function write(file, pipeline) {
  mkdirSync(path.dirname(file), { recursive: true });
  await pipeline.toFile(file);
  console.log(`[assets] ${path.relative(root, file)}`);
}

// --- Icônes -----------------------------------------------------------------------------------

// iOS refuse la transparence : plein cadre, sans coins arrondis (iOS les applique).
const iconOnly = svg(
  1024,
  `<rect width="1024" height="1024" fill="${TOKEN.accent}"/>` +
    mark({ leaf: TOKEN.paper, vein: TOKEN.accent, dot: TOKEN.amber }),
);
await write(path.join(assetsDir, 'icon-only.png'), png(iconOnly).flatten({ background: TOKEN.accent }).removeAlpha());

// Android adaptatif : 108 dp dont 72 dp visibles (zone sûre = cercle de 66 %) → motif réduit à 78 %.
await write(
  path.join(assetsDir, 'icon-foreground.png'),
  png(svg(1024, mark({ leaf: TOKEN.paper, vein: TOKEN.accent, dot: TOKEN.amber, scale: 0.78 }))),
);
await write(
  path.join(assetsDir, 'icon-background.png'),
  png(svg(1024, `<rect width="1024" height="1024" fill="${TOKEN.accent}"/>`)).removeAlpha(),
);

await write(
  path.join(assetsDir, 'store', 'play-icon-512.png'),
  sharp(path.join(assetsDir, 'icon-only.png')).resize(512, 512).png({ compressionLevel: 9 }),
);

// --- Écrans de lancement (2732², motif centré dans la zone sûre de ~1200 px) ------------------------

const splash = (bg, leaf, vein) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
       <rect width="2732" height="2732" fill="${bg}"/>
       <g transform="translate(1366 1366) scale(1.5) translate(-512 -512)">
         ${mark({ leaf, vein, dot: TOKEN.amber })}
       </g>
     </svg>`,
  );
await write(path.join(assetsDir, 'splash.png'), png(splash(TOKEN.paper, TOKEN.accent, TOKEN.paper)).removeAlpha());
await write(
  path.join(assetsDir, 'splash-dark.png'),
  png(splash(TOKEN.inkDark, TOKEN.accentDark, TOKEN.inkDark)).removeAlpha(),
);

// --- Icône de notification Android : silhouette blanche, nervures évidées, fond transparent -------------
// (Android ne garde que le canal alpha et teinte l'icône avec `iconColor` de capacitor.config.ts.)

const statMask = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <mask id="cut">
        <rect width="1024" height="1024" fill="white"/>
        <path d="${VEIN_MIDRIB}" stroke="black" stroke-width="40" stroke-linecap="round" fill="none"/>
        <path d="${VEIN_SIDES}" stroke="black" stroke-width="32" stroke-linecap="round" fill="none"/>
      </mask>
    </defs>
    <!-- feuille recadrée sur une boîte carrée de 24 dp avec ~2 dp de marge -->
    <g transform="translate(512 512) scale(1.5) translate(-512 -512)" mask="url(#cut)">
      <path d="${LEAF_PATH}" fill="white"/>
    </g>
  </svg>`;
const statSource = await sharp(Buffer.from(statMask)).png().toBuffer();
// Nervures du masque épaissies (×1,5 avec le motif) : à 24 dp, un trait plus fin disparaîtrait.
const sizes = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
for (const [bucket, px] of Object.entries(sizes)) {
  await write(
    path.join(resDir, `drawable-${bucket}`, 'ic_stat_captivia.png'),
    sharp(statSource).resize(px, px, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }),
  );
}

console.log('[assets] terminé.');
