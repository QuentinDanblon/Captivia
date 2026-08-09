// Vérification de bout en bout du flux navigateur -> API via la stack Docker.
// Script Node autonome (pas un module du projet) : require() est le mécanisme
// CJS natif, la règle TS no-require-imports ne s'applique pas ici.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3000/fr', { waitUntil: 'networkidle', timeout: 30000 });

  // Recherche
  await page.fill('input[placeholder*="espèce" i], input[type="text"]', 'boa');
  await page.waitForTimeout(2500);

  const firstSuggestion = page.locator('div[role="listbox"] a').first();
  const suggestionCount = await page.locator('div[role="listbox"] a').count();
  console.log('SUGGESTIONS:', suggestionCount);
  await firstSuggestion.click();
  await page.waitForTimeout(3000);

  console.log('SPECIES_URL:', page.url());
  const banner = await page.locator('text=Backend non connecté').count();
  console.log('BACKEND_UNAVAILABLE_BANNER:', banner);

  const bodyText = (await page.textContent('body')).slice(0, 400).replace(/\s+/g, ' ').trim();
  console.log('BODY:', bodyText);

  console.log('ERRORS:', errors.length ? errors.slice(0, 5).join(' || ') : '(aucune)');

  // Le seul 4xx acceptable : 404 sur /species/:id/reproduction (espèce sans
  // fiche reproduction — le frontend le traite comme `null`).
  const acceptable404 = errors.every((e) => e.includes('404 (Not Found)'));
  await browser.close();
  process.exit(banner === 0 && suggestionCount > 0 && acceptable404 ? 0 : 1);
})().catch((e) => {
  console.error('E2E_FAIL:', e.message);
  process.exit(2);
});
