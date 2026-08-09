// Test fiche Labrador Retriever complète + clic onglet Alimentation.
// Script Node autonome (pas un module du projet) : require() est le mécanisme
// CJS natif, la règle TS no-require-imports ne s'applique pas ici.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  // Aller directement sur la fiche du Labrador Retriever
  await page.goto('http://localhost:3000/species/2000000002', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const body0 = await page.locator('main').innerText();
  console.log('TITRE:', body0.split('\n')[0]);
  console.log('HABITAT:', body0.includes('libre') ? 'OUI' : 'NON');
  console.log('COMPORTEMENT:', body0.includes('semi-grégaire') || body0.includes('grégaire') ? 'OUI' : 'NON');
  console.log('REPRO:', body0.includes('Gestation') ? 'OUI' : 'NON');

  // Cliquer sur l'onglet Alimentation
  const alimentationTab = page.locator('button:has-text("Alimentation"), [role="tab"]:has-text("Alimentation")').first();
  await alimentationTab.click();
  await page.waitForTimeout(2500);
  const body = await page.locator('main').innerText();
  console.log('--- ONGLET ALIMENTATION ---');
  console.log('Aliments recommandés:', body.includes('Aliments recommandés') ? 'OUI' : 'NON');
  console.log('Aliments à éviter:', body.includes('Aliments à éviter') ? 'OUI' : 'NON');
  console.log('Besoins spécifiques:', body.includes('Besoins spécifiques') ? 'OUI' : 'NON');
  console.log('ERREURS:', errors.length ? errors.slice(0, 3).join(' || ') : '(aucune)');
  await browser.close();
})();
