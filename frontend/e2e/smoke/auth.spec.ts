import { expect, test, VALID_PASSWORD } from '../support/test';

const EMAIL = 'nouveau@captivia.test';

test.describe('Inscription', () => {
  test('formulaire : cases CGU et âge obligatoires, aucun appel API sans consentement', async ({ page, api }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { level: 1, name: 'Un compte pour ne plus rien oublier' })).toBeVisible();
    // L'essai sans compte reste proposé à côté de l'inscription.
    await expect(page.getByRole('button', { name: 'Essayer sans compte' })).toBeVisible();
    const terms = page.getByRole('checkbox', { name: /conditions générales d'utilisation/ });
    const age = page.getByRole('checkbox', { name: /15 ans ou plus/ });
    await expect(terms).not.toBeChecked();
    await expect(age).not.toBeChecked();

    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Mot de passe', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirmer le mot de passe').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    // Validation native du navigateur : la soumission est bloquée sur la case CGU manquante.
    await expect(terms).toHaveJSProperty('validity.valueMissing', true);
    await expect(page).toHaveURL(/\/register$/);
    expect(api.callsTo('POST', '/auth/register')).toHaveLength(0);
  });

  test('mots de passe différents : message d’erreur, aucun appel API', async ({ page, api }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Mot de passe', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirmer le mot de passe').fill('Autre-mot-de-passe-1');
    await page.getByRole('checkbox', { name: /conditions générales d'utilisation/ }).check();
    await page.getByRole('checkbox', { name: /15 ans ou plus/ }).check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Les deux mots de passe ne correspondent pas.' })).toBeVisible();
    expect(api.callsTo('POST', '/auth/register')).toHaveLength(0);
  });

  test('inscription réussie : consentements envoyés puis redirection vers Mes animaux', async ({ page, api }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Mot de passe', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirmer le mot de passe').fill(VALID_PASSWORD);
    await page.getByRole('checkbox', { name: /conditions générales d'utilisation/ }).check();
    await page.getByRole('checkbox', { name: /15 ans ou plus/ }).check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page).toHaveURL(/\/mes-animaux$/);
    await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();

    const [call] = api.callsTo('POST', '/auth/register');
    expect(call.body).toMatchObject({
      email: EMAIL,
      password: VALID_PASSWORD,
      locale: 'fr',
      acceptTerms: true,
      ageConfirmed: true,
    });
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('e2e-register-token');
  });
});

test.describe('Connexion', () => {
  test('identifiants incorrects : message d’erreur et session non ouverte', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('inconnu@captivia.test');
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Email ou mot de passe incorrect' })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('connexion réussie : redirection vers Mes animaux et jeton conservé', async ({ page, api }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Content de vous revoir' })).toBeVisible();

    await page.getByLabel('Email').fill('smoke@captivia.test');
    await page.getByLabel('Mot de passe').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/mes-animaux$/);
    await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('e2e-login-token');
    expect(api.callsTo('POST', '/auth/login')[0].body).toMatchObject({ email: 'smoke@captivia.test' });
  });

  test('Mes animaux sans session : essai sans compte ou connexion', async ({ page, api }) => {
    await page.goto('/mes-animaux');

    await expect(page).toHaveURL(/\/mes-animaux$/);
    await expect(page.getByRole('button', { name: 'Essayer sans compte' })).toBeVisible();
    await page.getByRole('link', { name: "J'ai déjà un compte" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Content de vous revoir' })).toBeVisible();
    // La connexion propose aussi l'essai sans compte.
    await expect(page.getByRole('button', { name: 'Essayer sans compte' })).toBeVisible();
    expect(api.callsTo('POST', '/auth/guest')).toHaveLength(0);
  });
});
