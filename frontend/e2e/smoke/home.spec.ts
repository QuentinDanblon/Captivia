import { expect, test } from '../support/test';

test.describe('Accueil et langue', () => {
  test('accueil FR : titre, hero et langue du document', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Captivia/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connaître le vivant.');
    await expect(page.getByRole('textbox', { name: 'Rechercher une espèce...' })).toBeVisible();
  });

  test('accueil EN : contenu anglais sous /en', async ({ page }) => {
    await page.goto('/en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know the living world.');
    await expect(page.getByRole('textbox', { name: 'Search for a species...' })).toBeVisible();
  });

  test('changement de langue : le sélecteur bascule vers /en en anglais', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connaître le vivant.');

    await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know the living world.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  });

  test('recherche : la requête part vers l’API et les résultats s’affichent', async ({ page, api }) => {
    await page.goto('/');

    const search = page.getByRole('textbox', { name: 'Rechercher une espèce...' });
    await search.fill('boa');
    await search.press('Enter');

    const results = page.getByTestId('species-result');
    await expect(results).toHaveCount(2);
    await expect(results.first()).toContainText('Boa constricteur');
    await expect(results.first()).toContainText('Boa constrictor Linnaeus, 1758');

    const queries = api.callsTo('GET', '/species/search').map((c) => c.query.get('q'));
    expect(queries).toContain('boa');
  });
});
