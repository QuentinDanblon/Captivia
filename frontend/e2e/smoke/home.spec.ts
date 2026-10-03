import { expect, test } from '../support/test';
import type { Page } from '@playwright/test';

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

  // Le changement de langue recharge la page (cookie NEXT_LOCALE + navigation pleine page) : on
  // attend la fin du chargement avant d'interagir, sinon le <select> n'est pas encore hydraté
  // (onChange inactif) ou les deux sélecteurs (bureau / mobile) sont visibles avant le CSS.
  async function settled(page: Page) {
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
  }

  test('changement de langue : le sélecteur bascule vers /en en anglais', async ({ page }) => {
    await page.goto('/');
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connaître le vivant.');

    await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
    await page.waitForURL(/\/en\/?$/);
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know the living world.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  });

  test('retour à la langue par défaut : EN → FR réaffiche le contenu français', async ({ page }) => {
    await page.goto('/');
    await settled(page);
    await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
    await page.waitForURL(/\/en\/?$/);
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know the living world.');

    await page.getByRole('combobox', { name: 'Language' }).selectOption('fr');
    await page.waitForURL((url) => !/^\/en(\/|$)/.test(url.pathname));
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connaître le vivant.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // La préférence persiste : un rechargement reste en français.
    await page.reload();
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connaître le vivant.');
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
