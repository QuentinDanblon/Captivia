import { expect, signIn, test } from '../support/test';

test.describe('Choix du thème', () => {
  test('en-tête du site : le contrôle visible bascule et garde le choix après rechargement', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const themeButton = page.getByRole('button', { name: 'Thème' });
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('captivia.theme'))).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Thème' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('paramètres : clair, sombre et système suivent les choix malgré la préférence système opposée', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await signIn(page);
    await page.goto('/parametres');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Clair', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('captivia.theme'))).toBe('light');

    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('button', { name: 'Sombre', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('captivia.theme'))).toBe('dark');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('button', { name: 'Système', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('captivia.theme'))).toBe('system');
  });

  test('le choix des paramètres est partagé avec le contrôle app et suit la navigation vers Espèces', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await signIn(page);
    await page.goto('/parametres');

    await page.getByRole('button', { name: 'Sombre', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('link', { name: 'Espèces', exact: true }).click();
    await expect(page).toHaveURL(/\/especes(?:\?.*)?$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Thème' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('link', { name: 'Compte', exact: true }).click();
    await expect(page).toHaveURL(/\/parametres(?:\?.*)?$/);
    await expect(page.getByRole('button', { name: 'Clair', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
