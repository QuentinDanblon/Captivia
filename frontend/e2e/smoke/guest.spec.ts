import {
  expect,
  fixture,
  GUEST_TOKEN,
  runAxe,
  signInAsGuest,
  TAKEN_EMAIL,
  test,
  UPGRADED_TOKEN,
  VALID_PASSWORD,
  type MockAnimal,
} from '../support/test';

/**
 * Mode invité (« Essayer sans compte ») : l'app s'utilise sans e-mail ni mot de passe avec
 * 1 animal et son carnet ; le 2e animal est verrouillé (compte + Premium) ; la création de
 * compte convertit la session sans perte de données.
 */
test.describe('Mode invité', () => {
  test('essai sans compte → ajout d’un animal → 2e animal verrouillé', async ({ page, api }) => {
    await page.goto('/mes-animaux');

    // Sans session : le choix, pas une redirection vers la connexion.
    await expect(page.getByRole('heading', { level: 1, name: 'Commencez le carnet de votre animal' })).toBeVisible();
    await expect(page.getByRole('link', { name: "J'ai déjà un compte" })).toHaveAttribute('href', /\/login$/);
    await page.getByRole('button', { name: 'Essayer sans compte' }).click();

    await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
    await expect(page).toHaveURL(/\/mes-animaux$/);
    expect(api.callsTo('POST', '/auth/guest')[0].body).toEqual({ locale: 'fr' });
    // Même stockage de session qu'une connexion (access + refresh token).
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(GUEST_TOKEN);
    expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('e2e-guest-refresh');
    await expect(page.getByRole('region', { name: 'Sauvegardez vos données' })).toBeVisible();

    // Premier animal : le parcours en étapes, directement sur la page (espèce, puis nom).
    await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
    await page.locator('#animal-species').fill('boa');
    await page.getByRole('button', { name: /Boa constrictor/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.locator('#animal-name').fill('Kaa');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Kaa a été ajouté')).toBeVisible();
    await expect(page.getByRole('link', { name: /Kaa/ }).first()).toBeVisible();
    const [create] = api.callsTo('POST', '/users/me/animals');
    expect(create.headers['authorization']).toBe(`Bearer ${GUEST_TOKEN}`);

    // Deuxième animal : emplacement verrouillé qui explique la valeur (compte + Premium).
    await expect(page.getByText('Ajouter un deuxième animal')).toBeVisible();
    await expect(page.getByText(/Plusieurs animaux : un compte, puis l'abonnement Premium/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ajouter un animal/ })).toHaveCount(0);
    // Toutes les invitations « Créer un compte » (bandeau, emplacement, en-tête) mènent à la conversion.
    const ctas = page.getByRole('link', { name: 'Créer un compte' });
    expect(await ctas.count()).toBeGreaterThanOrEqual(2);
    for (const link of await ctas.all()) await expect(link).toHaveAttribute('href', /\/sauvegarder$/);
    await expect(page.getByText('Kaa et son carnet ne sont accessibles que depuis cet appareil.', { exact: false })).toBeVisible();
    expect(api.callsTo('POST', '/users/me/animals')).toHaveLength(1);
  });

  test('création de compte depuis l’invité : e-mail pris (409) puis conversion sans rechargement', async ({ page, api }) => {
    await signInAsGuest(page);
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/sauvegarder');

    await expect(page.getByRole('heading', { level: 1, name: 'Créer votre compte' })).toBeVisible();
    await expect(page.getByText('Kaa et son carnet seront rattachés à votre compte.')).toBeVisible();

    const fill = async (email: string) => {
      await page.getByRole('textbox', { name: 'Email' }).fill(email);
      await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(VALID_PASSWORD);
      await page.getByRole('textbox', { name: 'Confirmer le mot de passe' }).fill(VALID_PASSWORD);
    };

    // Consentements obligatoires : aucun appel sans eux.
    await fill('kaa@captivia.test');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText(/accepter les conditions d'utilisation/)).toBeVisible();
    expect(api.callsTo('POST', '/auth/upgrade')).toHaveLength(0);

    await page.getByRole('checkbox', { name: /conditions générales d'utilisation/ }).check();
    await page.getByRole('checkbox', { name: /15 ans ou plus/ }).check();

    // Adresse déjà utilisée : 409, message explicite, aucune fusion.
    await fill(TAKEN_EMAIL);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText(/Un compte existe déjà avec cette adresse/)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(GUEST_TOKEN);

    await fill('kaa@captivia.test');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page.getByText('Compte créé. Un lien de confirmation a été envoyé à kaa@captivia.test.')).toBeVisible();
    const calls = api.callsTo('POST', '/auth/upgrade');
    expect(calls).toHaveLength(2);
    expect(calls[1].headers['authorization']).toBe(`Bearer ${GUEST_TOKEN}`);
    expect(calls[1].body).toMatchObject({
      email: 'kaa@captivia.test',
      password: VALID_PASSWORD,
      locale: 'fr',
      acceptTerms: true,
      ageConfirmed: true,
    });
    // Nouvelle session en place, profil à jour sans rechargement.
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(UPGRADED_TOKEN);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('user'))) ?? '{}')).toMatchObject({
      email: 'kaa@captivia.test',
      isGuest: false,
    });

    // Les données suivent : Mes animaux liste toujours Kaa, sans bandeau invité.
    await page.getByRole('link', { name: 'Retour à mes animaux' }).click();
    await expect(page.getByRole('link', { name: /Kaa/ }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sauvegardez vos données' })).toHaveCount(0);
    // Compte gratuit : le 2e animal mène désormais à Premium.
    await expect(page.getByRole('link', { name: 'Découvrir Premium' })).toHaveAttribute('href', /\/parametres\/abonnement$/);
  });

  test('actions réservées aux comptes : expliquées, jamais proposées à l’invité', async ({ page, api }) => {
    await signInAsGuest(page);
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/mes-animaux/animal-e2e-1');

    await expect(page.getByRole('heading', { level: 1, name: 'Kaa' })).toBeVisible();
    await expect(page.getByText(/La page publique de l'animal \(QR code\) demande un compte/)).toBeVisible();
    expect(api.callsTo('GET', '/users/me/animals/animal-e2e-1/public-link')).toHaveLength(0);

    const violations = await runAxe(page);
    expect(violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });
});
