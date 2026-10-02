import { expect, test } from '../support/test';

test.describe('Fiche espèce', () => {
  test('depuis la recherche : ouverture de la fiche et contenu', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('textbox', { name: 'Rechercher une espèce...' });
    await search.fill('boa');
    await search.press('Enter');

    await page.getByTestId('species-result').first().click();

    await expect(page).toHaveURL(/\/species\/2435099$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Boa constricteur');
    await expect(page.getByText('Boa constrictor Linnaeus, 1758').first()).toBeVisible();
    await expect(page.getByRole('tab', { name: "Vue d'ensemble" })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Grand serpent constricteur')).toBeVisible();
  });

  test('onglets Santé (avertissement vétérinaire) et Législation', async ({ page }) => {
    await page.goto('/species/2435099');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Boa constricteur');

    await page.getByRole('tab', { name: 'Santé' }).click();
    await expect(page.getByRole('tab', { name: 'Santé' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('ne remplacent pas un avis vétérinaire')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Stomatite infectieuse' })).toBeVisible();

    await page.getByRole('tab', { name: 'Législation' }).click();
    await expect(page.getByRole('tab', { name: 'Législation' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Certificat de capacité requis (fixture)')).toBeVisible();
  });

  test('espèce inconnue : message « introuvable » sans planter', async ({ page }) => {
    await page.goto('/species/999');

    await expect(page.getByText('Espèce introuvable')).toBeVisible();
    await expect(page.getByRole('link', { name: /Retour.*Accueil/i })).toBeVisible();
  });
});
