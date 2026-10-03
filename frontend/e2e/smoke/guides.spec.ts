import { expect, signIn, test, type MockAnimal } from '../support/test';

const CATEGORIES = [
  'dogs', 'cats', 'rodents', 'rabbits', 'mammals', 'birds',
  'reptiles', 'amphibians', 'freshwater', 'marine', 'insects', 'arachnids',
];

test.describe('Guides d’aménagement', () => {
  test('ouvre chacune des 12 catégories et permet de cocher le matériel', async ({ page }) => {
    await page.goto('/guides');
    await expect(page.getByRole('heading', { level: 1, name: 'Guides d’aménagement' })).toBeVisible();
    await expect(page.locator('a[href*="category="]')).toHaveCount(12);

    for (const category of CATEGORIES) {
      const link = page.locator(`a[href*="category=${category}"]`).first();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`[?&]category=${category}(?:&|$)`));
      await expect(link).toHaveAttribute('aria-current', 'page');
      expect(await link.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect(page.getByRole('heading', { level: 3, name: 'Matériel à préparer' })).toBeVisible();
      const firstItem = page.getByRole('checkbox').first();
      await firstItem.check();
      await expect(firstItem).toBeChecked();
    }
  });

  test('recherche une espèce et ouvre son guide depuis le clavier', async ({ page, api }) => {
    await page.goto('/guides');
    const search = page.getByRole('searchbox', { name: 'Rechercher une espèce' });
    await search.focus();
    await search.pressSequentially('boa');
    await search.press('Enter');

    await expect.poll(() => api.callsTo('GET', '/species/search').some((call) => call.query.get('q') === 'boa')).toBe(true);
    const result = page.getByRole('link', { name: /Boa constricteur/ });
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('href', /\/guides\?species=2435099$/);
    await result.focus();
    await result.press('Enter');
    await expect(page).toHaveURL(/\?species=2435099$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Boa constricteur' })).toBeVisible();
  });

  test('un animal du compte sélectionne le guide de son espèce', async ({ page, api }) => {
    await signIn(page);
    api.animals = [{ id: 'kaa', name: 'Kaa', speciesId: 2435099 } satisfies MockAnimal];
    await page.goto('/guides');

    const animals = page.getByRole('combobox', { name: 'Mes animaux' });
    await expect(animals).toBeVisible();
    await expect.poll(() => api.callsTo('GET', '/users/me/animals').length).toBeGreaterThan(0);
    await animals.selectOption('kaa');
    await expect(page).toHaveURL(/\?species=2435099&animal=kaa$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Boa constricteur' })).toBeVisible();
    expect(api.callsTo('GET', '/users/me/animals')).toHaveLength(1);
  });

  test('un poisson sans habitat sourcé demande un milieu et conserve son espèce entre les choix', async ({ page }) => {
    await page.route(
      (url) => url.origin === 'http://127.0.0.1:4010' && url.pathname === '/species/2435101',
      (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          key: 2435101,
          canonicalName: 'Danio rerio',
          scientificName: 'Danio rerio',
          class: 'Actinopterygii',
          profile: { speciesId: 2435101, commonNameFr: 'Danio rerio', scientificName: 'Danio rerio', category: 'fish' },
          habitat: { sources: [] },
        }),
      }),
    );
    await page.goto('/guides?species=2435101');

    await expect(page.getByRole('heading', { level: 2, name: 'Danio rerio' })).toBeVisible();
    await expect(page.getByText('Pour ce poisson, choisissez eau douce ou eau de mer selon son milieu de vie.')).toBeVisible();
    await expect(page.getByText('Les besoins d’habitat de cette espèce ne sont pas encore documentés avec une source.')).toBeVisible();
    await page.locator('a[href*="category=freshwater"]').click();
    await expect(page).toHaveURL(/category=freshwater&species=2435101$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Danio rerio' })).toBeVisible();
    await page.locator('a[href*="category=marine"]').click();
    await expect(page).toHaveURL(/category=marine&species=2435101$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Aquarium d’eau de mer' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Danio rerio' })).toBeVisible();
  });

  test('annonce une erreur de recherche et laisse réessayer', async ({ page }) => {
    let unavailable = true;
    await page.route(
      (url) => url.origin === 'http://127.0.0.1:4010' && url.pathname === '/species/search',
      (route) => unavailable ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"unavailable"}' }) : route.fallback(),
    );
    await page.goto('/guides');
    await page.getByRole('searchbox', { name: 'Rechercher une espèce' }).fill('boa');
    await page.getByRole('button', { name: 'Rechercher' }).click();
    await expect(page.getByRole('status')).toContainText('Le guide de cette espèce n’a pas pu être chargé.');
    unavailable = false;
    await page.getByRole('button', { name: 'Rechercher' }).click();
    await expect(page.getByRole('link', { name: /Boa constricteur/ })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('le plan coté se remplit au clavier et calcule uniquement le volume géométrique', async ({ page }) => {
    await page.goto('/guides?category=freshwater');
    const length = page.getByRole('spinbutton', { name: 'Longueur (cm)' });
    const width = page.getByRole('spinbutton', { name: 'Largeur (cm)' });
    const height = page.getByRole('spinbutton', { name: 'Hauteur (cm)' });
    await expect(width).toBeVisible();
    await expect(height).toBeVisible();
    await length.focus();
    await length.pressSequentially('100');
    await page.keyboard.press('Tab');
    await page.keyboard.type('40');
    await page.keyboard.press('Tab');
    await page.keyboard.type('15');

    await expect(page.locator('output')).toHaveText('Volume géométrique : 60 L');
    await expect(page.getByRole('img', { name: 'Vue de dessus' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Vue de face' })).toBeVisible();
    await page.getByText('Placer le matériel sur votre plan', { exact: true }).click();
    const equipment = page.getByRole('combobox', { name: 'Aquarium et filtration adaptée', exact: true });
    await equipment.selectOption('left');
    await expect(page.locator('svg[aria-label="Vue de dessus"] g')).toHaveCount(1);
    await expect(page.getByText('1. Aquarium et filtration adaptée — À gauche', { exact: true })).toBeVisible();
    await equipment.selectOption('none');
    await expect(page.locator('svg[aria-label="Vue de dessus"] g')).toHaveCount(0);
  });
});
