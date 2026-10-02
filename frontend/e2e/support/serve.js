/**
 * Lance le build de production du frontend pour le smoke Playwright.
 *
 * next.config.ts utilise `output: 'standalone'` : `next start` n'est alors pas supporté
 * (réponses 500). Comme dans le Dockerfile, on exécute `.next/standalone/.../server.js`
 * après y avoir copié `.next/static` et `public`. L'emplacement de server.js dépend de la
 * racine de workspace détectée par Next.js (`standalone/server.js` ou `standalone/frontend/server.js`).
 *
 * Prérequis : `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run build`.
 */
const fs = require('node:fs');
const path = require('node:path');

const frontendDir = path.resolve(__dirname, '..', '..');
const standaloneDir = path.join(frontendDir, '.next', 'standalone');

const serverFile = [path.join(standaloneDir, 'server.js'), path.join(standaloneDir, 'frontend', 'server.js')].find((file) =>
  fs.existsSync(file),
);
if (!serverFile) {
  console.error(
    `[e2e] Build standalone introuvable dans ${standaloneDir}.\n` +
      '[e2e] Lancez d’abord : NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run build',
  );
  process.exit(1);
}

const appDir = path.dirname(serverFile);
const copies = [
  [path.join(frontendDir, '.next', 'static'), path.join(appDir, '.next', 'static')],
  [path.join(frontendDir, 'public'), path.join(appDir, 'public')],
];
for (const [from, to] of copies) {
  if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true });
}

process.env.PORT = process.env.PORT || '3100';
// « localhost » exactement : le middleware i18n de Next.js construit ses URL de réécriture à partir
// de HOSTNAME ; toute autre valeur (127.0.0.1, 0.0.0.0) les rend « externes » et boucle en 307.
// ipv4first : localhost -> 127.0.0.1, cohérent avec --host-resolver-rules de playwright.config.ts.
require('node:dns').setDefaultResultOrder('ipv4first');
process.env.HOSTNAME = 'localhost';
process.env.NEXT_TELEMETRY_DISABLED = '1';
require(serverFile);
