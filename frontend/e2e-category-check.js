// Test : clic sur catégorie -> toutes les fiches de la catégorie + Voir plus.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3000/fr', { waitUntil: 'networkidle', timeout: 30000 });

  // Cliquer sur la catégorie Reptile
  const reptileCard = page.locator('button:has-text("Reptile")').first();
  await reptileCard.click();
  await page.waitForTimeout(3000);

  const count = await page.locator('div[role="listbox"]').count();
  const results = await page.locator('[data-testid="species-result"]').count();
  const countText = await page.locator('.captivia-results-count').textContent().catch(() => '');
  console.log('RÉSULTATS affichés:', results, '| compteur:', countText.trim());

  // Vérifier que c'est bien des reptiles
  const firstCards = await page.locator('[data-testid="species-result"] h3').allTextContents();
  console.log('PREMIÈRES fiches:', firstCards.slice(0, 4).join(', '));

  // Cliquer Voir plus
  const voirPlus = page.locator('.captivia-load-more');
  if (await voirPlus.count() > 0) {
    await voirPlus.click();
    await page.waitForTimeout(3000);
    const results2 = await page.locator('[data-testid="species-result"]').count();
    console.log('Après Voir plus:', results2, 'résultats');
  } else {
    console.log('PAS de bouton Voir plus');
  }

  // Naviguer vers une fiche
  const firstLink = page.locator('[data-testid="species-result"]').first();
  if (await firstLink.count() > 0) {
    const href = await firstLink.getAttribute('href');
    console.log('Lien fiche:', href);
  }
  console.log('ERREURS:', errors.length ? errors.slice(0, 3).join(' || ') : '(aucune)');
  await browser.close();
})();
