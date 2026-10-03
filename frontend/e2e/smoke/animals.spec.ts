import { expect, fixture, signIn, test, type MockAnimal } from '../support/test';

test.describe('Mes animaux', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('liste vide : état vide affiché', async ({ page }) => {
    await page.goto('/mes-animaux');

    await expect(page.getByRole('heading', { level: 1, name: 'Mes animaux' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aucun animal ajouté' })).toBeVisible();
  });

  test('liste : animal existant, limite gratuite et lien vers le détail', async ({ page, api }) => {
    api.animals = [{ ...fixture<MockAnimal>('animal'), speciesName: 'Boa constrictor' }];
    await page.goto('/mes-animaux');

    // Carte en <article> : lien étiré sur le nom, lien « carnet » frère (pas de lien imbriqué).
    const card = page.locator('article').filter({ has: page.getByRole('link', { name: 'Kaa' }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Boa constrictor');
    await expect(card.getByRole('link', { name: 'Carnet de santé' })).toHaveAttribute(
      'href',
      /\/mes-animaux\/animal-e2e-1\/carnet$/,
    );
    await expect(card.locator('a a, a button')).toHaveCount(0);
    // Compte gratuit : un seul animal ; l'ajout est remplacé par l'emplacement verrouillé (Premium).
    await expect(page.getByRole('button', { name: /Ajouter un animal/ })).toHaveCount(0);
    await expect(page.getByText('Ajouter un deuxième animal')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Découvrir Premium' })).toHaveAttribute('href', /\/parametres\/abonnement$/);

    // Le titre (et non le centre de la vignette, couvert par le bouton « changer la photo »).
    await card.getByRole('heading', { name: 'Kaa' }).click();
    await expect(page).toHaveURL(/\/mes-animaux\/animal-e2e-1$/);
  });

  test('ajout d’un animal : formulaire, envoi à l’API puis affichage dans la liste', async ({ page, api }) => {
    await page.goto('/mes-animaux');
    await expect(page.getByRole('heading', { name: 'Aucun animal ajouté' })).toBeVisible();

    await page.getByRole('button', { name: /Ajouter un animal/ }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Ajouter un animal' })).toBeVisible();

    await page.locator('#animal-name').fill('Kaa');
    await page.locator('#animal-species').fill('boa');
    await page.getByRole('button', { name: /Boa constrictor/ }).click();
    await page.getByText('Mâle', { exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Kaa a été ajouté')).toBeVisible();
    await expect(page.getByRole('link', { name: /Kaa/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Ajouter un animal' })).toBeHidden();

    const [call] = api.callsTo('POST', '/users/me/animals');
    expect(call.body).toMatchObject({ name: 'Kaa', speciesId: 2435099, sex: 'male' });
    expect(call.headers['authorization']).toMatch(/^Bearer /);
  });

  test('ajout sans espèce choisie : enregistrement impossible, aucun envoi', async ({ page, api }) => {
    await page.goto('/mes-animaux');
    await page.getByRole('button', { name: /Ajouter un animal/ }).first().click();

    await page.locator('#animal-name').fill('Kaa');
    // Texte saisi mais aucune espèce sélectionnée dans la liste de suggestions.
    await page.locator('#animal-species').fill('boa');
    await expect(page.getByRole('button', { name: /Boa constrictor/ })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(api.callsTo('POST', '/users/me/animals')).toHaveLength(0);
  });

  test('détail d’un animal : fiche chargée avec les données de l’espèce', async ({ page, api }) => {
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/mes-animaux/animal-e2e-1');

    await expect(page.getByRole('heading', { level: 1, name: 'Kaa' })).toBeVisible();
    expect(api.callsTo('GET', '/users/me/animals/animal-e2e-1')).not.toHaveLength(0);
    expect(api.callsTo('GET', '/species/2435099')).not.toHaveLength(0);
  });

  test('détail d’un animal inexistant : message « introuvable »', async ({ page }) => {
    await page.goto('/mes-animaux/inconnu');

    await expect(page.getByText("Erreur lors du chargement des données de l'animal")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retour Mes animaux' })).toBeVisible();
  });
});
