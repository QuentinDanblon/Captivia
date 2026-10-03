import { expect, test } from '../support/test';

const LEGAL_PAGES = [
  { path: '/mentions-legales', footerLink: 'Mentions légales' },
  { path: '/confidentialite', footerLink: 'Confidentialité' },
  { path: '/cgu', footerLink: "Conditions d'utilisation" },
  { path: '/sources-et-licences', footerLink: 'Sources et licences' },
  { path: '/transparency', footerLink: 'Transparence & affiliation' },
  { path: '/suppression-compte', footerLink: 'Supprimer mon compte' },
];

test.describe('Pages légales', () => {
  for (const { path, footerLink } of LEGAL_PAGES) {
    test(`${path} : accessible depuis le pied de page, titre et contenu`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Informations légales' }).getByRole('link', { name: footerLink, exact: true }).click();

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toBeVisible();
      await expect(title).not.toBeEmpty();
      await expect(page.locator('main')).toContainText(/\S{4,}\s+\S{4,}/);
    });
  }

  test('le pied de page rappelle la mention d’affiliation Amazon', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('contentinfo')).toContainText('Partenaire Amazon');
  });
});

test.describe('Page 404', () => {
  test('URL inconnue : vraie 404 avec la page Captivia et lien de retour', async ({ page }) => {
    const response = await page.goto('/cette-page-n-existe-pas');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();

    await page.getByRole('link', { name: "Retour à l'accueil" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vous les aimez.');
  });

  test('404 localisée en anglais', async ({ page }) => {
    const response = await page.goto('/en/does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });
});
