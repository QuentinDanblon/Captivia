import { expect, runAxe, test } from '../support/test';

const categories = [
  'Mammifères',
  'Oiseaux',
  'Reptiles',
  'Amphibiens',
  'Poissons',
  'Insectes',
];

test.describe('Catégories illustrées de la recherche', () => {
  test('carrousel, photos cadrées, choix accessible et ouverture des résultats', async ({ page, api }) => {
    await page.goto('/especes');

    const cards = page.locator('.species-category-card');
    await expect(cards).toHaveCount(categories.length);
    for (const name of categories) {
      const card = page.getByRole('button', { name: new RegExp(`^${name}\\b`) });
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('aria-pressed', 'false');
      const image = card.locator('img');
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveCSS('object-fit', 'cover');
    }

    const explorer = page.locator('.species-explorer');
    await expect(explorer).toHaveAttribute('data-category-texture', 'none');
    await page.getByRole('button', { name: /^Reptiles\b/ }).click();
    await expect(page.getByRole('button', { name: /^Reptiles\b/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(explorer).toHaveAttribute('data-category-texture', 'reptiles');
    await expect(page).toHaveURL(/groupe=reptiles/);
    await expect.poll(() => api.callsTo('GET', '/species/search').some((call) => call.query.get('class') === 'Reptilia')).toBe(true);
    const serious = (await runAxe(page)).filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Les résultats restent ouvrables après le choix de la catégorie.
    await page.getByTestId('species-card').filter({ hasText: 'Boa constricteur' }).getByRole('link', { name: 'Boa constricteur' }).click();
    await expect(page).toHaveURL(/\/species\/2435099$/);
  });

  test('aucun débordement horizontal sur un écran de 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/especes');
    await expect(page.locator('.species-category-card').first()).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  });

  test('le carrousel se défile horizontalement sans sélectionner une catégorie', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/especes');
    const rail = page.locator('.species-category-cards');
    const cards = page.locator('.species-category-card');
    await expect(cards).toHaveCount(categories.length);
    await expect(rail).toHaveAttribute('tabindex', '0');
    await expect(rail).toHaveCSS('overflow-x', 'auto');
    await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).scrollSnapType)).toMatch(/^x( proximity)?$/);
    await expect(cards.first()).toBeVisible();
    await expect.poll(() => rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(() => rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    const visibleCards = await rail.evaluate((element) => {
      const rightEdge = element.getBoundingClientRect().right;
      return [...element.querySelectorAll('.species-category-item')].filter((card) => card.getBoundingClientRect().left < rightEdge).length;
    });
    expect(visibleCards).toBeGreaterThan(1);

    await page.setViewportSize({ width: 390, height: 844 });

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const box = (await cards.first().boundingBox())!;
    const startX = Math.floor(box.x + box.width * 0.8);
    const y = Math.floor(box.y + box.height / 2);
    const before = await rail.evaluate((element) => element.scrollLeft);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - step * 24, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 30);
    await expect(page.locator('.species-explorer')).toHaveAttribute('data-category-texture', 'none');
    await expect(page.locator('.species-category-card[aria-pressed="true"]')).toHaveCount(0);
    await cdp.detach();
  });

  test('un glissement tactile sur une photo fait défiler sans choisir une catégorie', async ({ page }) => {
    await page.goto('/especes');
    const cards = page.locator('.species-category-card');
    await expect(cards.first()).toBeVisible();
    await cards.first().scrollIntoViewIfNeeded();
    const initiallySelected = await page.locator('.species-explorer').getAttribute('data-category-texture');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const box = (await cards.first().boundingBox())!;
    const x = Math.floor(box.x + box.width / 2);
    const start = Math.floor(box.y + box.height * 0.7);
    const before = await page.evaluate(() => window.scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start - step * 24 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 30);
    await expect(page.locator('.species-explorer')).toHaveAttribute('data-category-texture', initiallySelected!);
    await expect(page.locator('.species-category-card[aria-pressed="true"]')).toHaveCount(0);
    await cdp.detach();
  });
});
