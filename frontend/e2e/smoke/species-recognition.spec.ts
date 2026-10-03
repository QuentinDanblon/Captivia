import { expect, fixture, signIn, test, type MockAnimal } from '../support/test';

const animals = [
  { key: 5287871, canonicalName: 'Canis familiaris', scientificName: 'Canis familiaris', vernacularName: 'Chien', class: 'Mammalia' },
  { key: 5281802, canonicalName: 'Felis catus', scientificName: 'Felis catus', vernacularName: 'Chat domestique', class: 'Mammalia' },
  { key: 5221172, canonicalName: 'Eublepharis macularius', scientificName: 'Eublepharis macularius', vernacularName: 'Gecko Léopard', class: 'Reptilia' },
];

test.describe('Reconnaître les espèces', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://127.0.0.1:4010/species/search**', (route) => route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ results: animals, total: animals.length }),
    }));
  });

  test('catalogue : les photos du chien, du chat et du gecko se chargent avec leurs crédits', async ({ page, api }) => {
    await page.goto('/especes');
    const cards = page.getByTestId('species-card');
    await expect(cards).toHaveCount(3);
    for (const animal of animals) {
      const card = cards.filter({ hasText: animal.vernacularName });
      const photo = card.getByRole('img');
      await expect(photo).toBeVisible();
      await expect.poll(() => photo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      await expect(card.locator('a[rel~="license"]')).toBeVisible();
      await expect(photo).toHaveAttribute('src', /\/images\/animals\//);
    }
    expect(api.calls.filter((call) => call.path.endsWith('/media'))).toHaveLength(0);
  });

  test('ajout : choisir son animal en reconnaissant la photo de son espèce', async ({ page }) => {
    await signIn(page);
    await page.goto('/mes-animaux');
    await page.locator('#animal-species').fill('gecko');
    const choice = page.getByRole('button', { name: /Gecko Léopard/ });
    const photo = page.getByRole('img', { name: 'Gecko Léopard', exact: true });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole('link', { name: 'George Chernilevsky' })).toBeVisible();
    await choice.click();
    await expect(page.getByRole('button', { name: 'Suivant' })).toBeEnabled();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('heading', { name: "Comment s'appelle-t-il ?" })).toBeVisible();
  });

  test('fiche animal : le bouton vert voisin du carnet ouvre la bonne espèce sans débordement', async ({ page, api }) => {
    api.animals = [fixture<MockAnimal>('animal')];
    await signIn(page);
    if ((page.viewportSize()?.width ?? 1280) < 1024) await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/mes-animaux/animal-e2e-1');
    await expect(page.getByRole('heading', { level: 1, name: 'Kaa' })).toBeVisible();
    const guide = page.getByRole('link', { name: 'Fiche de l’espèce', exact: true });
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute('href', '/species/2435099');
    await expect(guide).toHaveClass(/bg-accent/);
    expect(await guide.evaluate((link) => link.previousElementSibling?.textContent)).toMatch(/Carnet/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const rect = await guide.boundingBox();
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await guide.click();
    await expect(page).toHaveURL(/\/species\/2435099$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Boa constricteur');
  });
});
