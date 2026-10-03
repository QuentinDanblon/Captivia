import { readFileSync } from 'node:fs';
import { expect, fixture, signIn, test, VALID_PASSWORD } from '../support/test';

// Note : la modale de suppression s'affiche aujourd'hui avec une largeur d'environ 48 px (ses boutons
// sortent du viewport, donc ne sont pas cliquables) : la confirmation est donc soumise au clavier
// (Entrée) et l'annulation par Échap. À remplacer par des clics une fois la mise en page corrigée.
test.describe('Paramètres du compte (RGPD)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('export des données : téléchargement du fichier JSON', async ({ page, api }) => {
    await page.goto('/parametres/compte');
    await expect(page.getByRole('heading', { level: 1, name: 'Compte' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter mes données' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^captivia-export-\d{4}-\d{2}-\d{2}\.json$/);
    const content = JSON.parse(readFileSync((await download.path()) as string, 'utf8'));
    expect(content).toEqual(fixture('account-export'));
    await expect(page.getByText('Export téléchargé')).toBeVisible();
    expect(api.callsTo('GET', '/users/me/export')).toHaveLength(1);
  });

  test('suppression : la confirmation est exigée, annuler n’envoie rien', async ({ page, api }) => {
    await page.goto('/parametres/compte');

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Supprimer définitivement votre compte ?' });
    await expect(dialog).toBeVisible();

    // Mot de passe vide : refus côté client (soumission au clavier, cf. note en haut du fichier).
    await dialog.getByLabel('Saisissez votre mot de passe pour confirmer').press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Le mot de passe est requis.');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(api.callsTo('DELETE', '/users/me')).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
  });

  test('suppression : mot de passe incorrect puis confirmation valide', async ({ page, api }) => {
    await page.goto('/parametres/compte');

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    const dialog = page.getByRole('alertdialog');
    const password = dialog.getByLabel('Saisissez votre mot de passe pour confirmer');

    await password.fill('mauvais-mot-de-passe');
    await password.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Mot de passe incorrect.');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();

    await password.fill(VALID_PASSWORD);
    await password.press('Enter');

    // Compte supprimé : déconnexion et retour à l'accueil.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vous les aimez.');
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

    const deletes = api.callsTo('DELETE', '/users/me');
    expect(deletes.map((c) => c.body)).toEqual([{ password: 'mauvais-mot-de-passe' }, { password: VALID_PASSWORD }]);
  });
});
