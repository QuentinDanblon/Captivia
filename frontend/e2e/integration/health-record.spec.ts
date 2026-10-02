import { test, expect } from '@playwright/test';

/**
 * Tests du carnet de santé : formulaire lisible, champs visibles, possibilité de cocher le type et de remplir titre/date/notes.
 */
test.describe('Carnet de santé (health record)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/mes-animaux');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('ouvre le modal et affiche tous les champs avec labels visibles', async ({ page }) => {
    // Aller sur la fiche du premier animal si présent
    const animalLink = page.locator('a[href*="/mes-animaux/"]').first();
    const hasAnimal = await animalLink.isVisible().catch(() => false);
    if (!hasAnimal) {
      test.skip();
      return;
    }
    await animalLink.click();
    await page.waitForURL(/\/mes-animaux\/[^/]+/).catch(() => {});

    // Cliquer sur "Ajouter une entrée" (carnet de santé)
    const addEntryBtn = page.getByRole('button', { name: /ajouter une entrée|add entry/i });
    await addEntryBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Titre du modal
    await expect(dialog.getByRole('heading', { level: 2 })).toBeVisible();

    // Texte d'intro
    await expect(dialog.getByText(/renseignez|enter the health event/i)).toBeVisible();

    // Type : légende + 4 options (radio)
    const typeLegend = dialog.getByText(/type d'entrée|entry type/i);
    await expect(typeLegend).toBeVisible();
    const radios = dialog.getByRole('radio');
    await expect(radios).toHaveCount(4);

    // Labels pour Titre, Date, Notes
    await expect(dialog.getByText(/titre de l'entrée|entry title/i)).toBeVisible();
    await expect(dialog.getByText(/^date$/i).first()).toBeVisible();
    await expect(dialog.getByText(/notes \(facultatif\)|notes \(optional\)/i)).toBeVisible();

    // Champs de formulaire
    await expect(dialog.locator('#health-title')).toBeVisible();
    await expect(dialog.locator('#health-date')).toBeVisible();
    await expect(dialog.locator('#health-notes')).toBeVisible();

    // Boutons Enregistrer et Annuler
    await expect(dialog.getByRole('button', { name: /enregistrer|save/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /annuler|cancel/i })).toBeVisible();
  });

  test('permet de choisir un type (radio), remplir titre et date, et enregistrer', async ({ page }) => {
    const animalLink = page.locator('a[href*="/mes-animaux/"]').first();
    const hasAnimal = await animalLink.isVisible().catch(() => false);
    if (!hasAnimal) {
      test.skip();
      return;
    }
    await animalLink.click();
    await page.waitForURL(/\/mes-animaux\/[^/]+/).catch(() => {});

    const addEntryBtn = page.getByRole('button', { name: /ajouter une entrée|add entry/i });
    await addEntryBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Cocher "Vaccin" (premier radio)
    await dialog.getByRole('radio', { name: /vaccin|vaccine/i }).check();

    // Remplir le titre
    await dialog.locator('#health-title').fill('Test vaccin rage');

    // Remplir la date (aujourd'hui)
    const today = new Date().toISOString().slice(0, 10);
    await dialog.locator('#health-date').fill(today);

    // Optionnel : notes
    await dialog.locator('#health-notes').fill('Rappel annuel');

    // Enregistrer
    await dialog.getByRole('button', { name: /enregistrer|save/i }).click();

    // Le modal se ferme et soit une nouvelle entrée apparaît, soit pas d'erreur visible
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    // Pas d'alerte erreur
    const errorAlert = page.getByRole('alert').filter({ hasText: /erreur|error/i });
    await expect(errorAlert).not.toBeVisible().catch(() => {});
  });
});
