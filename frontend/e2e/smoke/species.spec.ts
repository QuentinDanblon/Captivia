import type { Page } from '@playwright/test';
import { expect, fixture, runAxe, test } from '../support/test';

const API = 'http://127.0.0.1:4010';
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

/** Remplace une réponse GET de l'API simulée pour ce test (prioritaire sur mock-api.ts). */
async function overrideApi(page: Page, pathname: string, body: unknown, status = 200) {
  await page.route(
    (url) => url.origin === API && url.pathname === pathname,
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status, headers: CORS, body: JSON.stringify(body) })
        : route.fallback(),
  );
}

async function expectNoSeriousViolations(page: Page) {
  const violations = await runAxe(page);
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id} : ${v.help}`)).toEqual([]);
}

test.describe("Recherche d'espèces dans l'app", () => {
  test('cartes illustrées, filtre par groupe, recherche et ouverture de la fiche', async ({ page, api }) => {
    await page.goto('/especes');
    await expect(page.getByRole('heading', { level: 1, name: 'Espèces' })).toBeVisible();

    // Sans critère : toutes les fiches (l'API exige un filtre, la page envoie le règne animal).
    const cards = page.getByTestId('species-card');
    await expect(cards).toHaveCount(2);
    expect(api.callsTo('GET', '/species/search')[0].query.get('kingdom')).toBe('Animalia');
    await expect(page.getByText('2 fiches')).toBeVisible();

    // Photo sous licence libre créditée (la première, NC, est écartée) ; sinon silhouette.
    const boa = cards.filter({ hasText: 'Boa constricteur' });
    await expect(boa.getByRole('img', { name: 'Boa constricteur, photographie' })).toBeVisible();
    await expect(boa.getByRole('link', { name: 'Ana Martínez' })).toHaveAttribute('href', 'https://photos.example.org/boa/by');
    await expect(boa.getByRole('link', { name: 'CC BY 4.0' })).toBeVisible();
    await expect(boa).not.toContainText('Photographe NC');
    const imperial = cards.filter({ hasText: 'Boa impérial' });
    await expect(imperial.locator('img')).toHaveCount(0);
    await expect(imperial).not.toContainText('Photo');

    // Filtre par groupe : envoyé à l'API, reflété dans l'URL.
    await page.getByRole('button', { name: 'Reptiles' }).click();
    await expect(page.getByRole('button', { name: 'Reptiles' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/groupe=reptiles/);
    await expect.poll(() => api.callsTo('GET', '/species/search').some((c) => c.query.get('class') === 'Reptilia')).toBe(true);

    // Recherche pendant la frappe.
    await page.getByRole('searchbox', { name: 'Rechercher une espèce' }).fill('boa');
    await expect.poll(() => api.callsTo('GET', '/species/search').some((c) => c.query.get('q') === 'boa')).toBe(true);
    await expect(page.getByRole('heading', { level: 2, name: 'Résultats pour « boa »' })).toBeVisible();

    await boa.getByRole('link', { name: 'Boa constricteur' }).click();
    await expect(page).toHaveURL(/\/species\/2435099$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Boa constricteur');
  });

  test('aucun résultat, puis erreur réseau : états dédiés', async ({ page }) => {
    await overrideApi(page, '/species/search', { results: [], total: 0 });
    await page.goto('/especes?q=zzz');
    await expect(page.getByRole('heading', { name: 'Aucune fiche pour « zzz »' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Effacer la recherche' })).toBeVisible();

    await overrideApi(page, '/species/search', {}, 503);
    await page.getByRole('button', { name: 'Reptiles' }).click();
    await expect(page.getByText('La recherche ne répond pas pour le moment')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });

  test("l'onglet Espèces de l'app mène à la recherche", async ({ page }) => {
    await page.goto('/species/2435099');
    const tab = page
      .getByRole('navigation', { name: /^Navigation (principale|mobile)$/ })
      .locator('visible=true')
      .getByRole('link', { name: 'Espèces', exact: true });
    await expect(tab).toHaveAttribute('href', '/especes');
    await expect(tab).toHaveAttribute('aria-current', 'page');
  });

  test('axe : aucune violation sérieuse', async ({ page }) => {
    await page.goto('/especes');
    await expect(page.getByTestId('species-card').first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});

test.describe('Fiche espèce', () => {
  test('en-tête « planche », photo créditée, sections et lien vers l’ajout', async ({ page }) => {
    await page.goto('/species/2435099');
    const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) }).first();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Boa constricteur');
    await expect(header.locator('i[lang="la"]').first()).toHaveText('Boa constrictor');
    await expect(header.getByText('Linnaeus, 1758')).toBeVisible();
    await expect(header.getByText('GBIF 2435099')).toBeVisible();
    await expect(header.getByText('Espèce', { exact: true })).toBeVisible();
    await expect(header.getByText('Préoccupation mineure')).toBeVisible();
    await expect(page.getByText('SPECIES')).toHaveCount(0);

    // Photo : licence libre et auteur fournis → photo avec crédit (la photo NC est écartée).
    await expect(header.getByRole('img', { name: 'Boa constricteur, photographie' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Ana Martínez' })).toHaveAttribute('href', 'https://photos.example.org/boa/by');
    await expect(header.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    await expect(page.getByText('Photographe NC')).toHaveCount(0);

    await expect(page.getByTestId('add-species-animal')).toHaveAttribute(
      'href',
      '/mes-animaux?addSpecies=2435099&speciesName=Boa%20constrictor',
    );

    // Sections, chiffres et avertissements.
    await expect(page.getByRole('region', { name: 'Habitat' })).toContainText('28-32 °C');
    await expect(page.getByRole('region', { name: 'Alimentation' })).toContainText('Tous les 7 à 10 jours');
    await expect(page.getByRole('region', { name: 'Comportement' })).toContainText('Solitaire : à garder seul');
    const health = page.getByRole('region', { name: 'Santé' });
    await expect(health).toContainText('ne remplacent pas un avis vétérinaire');
    await expect(health.getByRole('heading', { name: 'Stomatite infectieuse' })).toBeVisible();
    const legal = page.getByRole('region', { name: 'Législation' });
    await expect(legal).toContainText('Vérifiez toujours la réglementation locale');
    await expect(legal).toContainText('Certificat de capacité requis (fixture)');
    await expect(page.getByRole('region', { name: 'Sources' }).getByRole('link', { name: "Guide d'élevage de test" })).toHaveCount(1);

    // Navigation dans la page : ancres (mobile) ou sommaire collant (bureau).
    await page.getByRole('navigation', { name: 'Sur cette fiche' }).locator('visible=true').getByRole('link', { name: /Législation/ }).click();
    await expect(page).toHaveURL(/#legislation$/);
  });

  test('sans photo sous licence libre : silhouette, aucun crédit', async ({ page }) => {
    await overrideApi(page, '/species/2435099/media', fixture<unknown[]>('species-media').slice(0, 1));
    await page.goto('/species/2435099');
    const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) }).first();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Boa constricteur');
    await expect(header.locator('.cv-photo__fallback svg')).toBeVisible();
    await expect(header.locator('img')).toHaveCount(0);
    await expect(page.getByText('Photographe NC')).toHaveCount(0);
    await expect(page.getByText('CC BY 4.0')).toHaveCount(0);
  });

  test('statut réglementaire non relu : mention « À confirmer »', async ({ page }) => {
    const legislation = fixture<{ editorial: Array<{ details: Record<string, unknown> }> }>('species-legislation');
    legislation.editorial[0].details.needsReview = true;
    await overrideApi(page, '/species/2435099/legislation', legislation);
    await page.goto('/species/2435099');
    const legal = page.getByRole('region', { name: 'Législation' });
    await expect(legal.getByText('À confirmer')).toBeVisible();
    await expect(legal).toContainText("n'a pas encore été vérifié");
  });

  test('depuis la recherche de la landing', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'Rechercher une espèce' });
    await search.fill('boa');
    await search.press('Enter');
    await page.getByTestId('species-result').first().click();
    await expect(page).toHaveURL(/\/species\/2435099$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Boa constricteur');
  });

  test('espèce inconnue : fiche introuvable, retour à la recherche', async ({ page }) => {
    await page.goto('/species/999');
    await expect(page.getByRole('heading', { level: 1, name: 'Cette fiche est introuvable' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chercher une espèce' })).toHaveAttribute('href', '/especes');
  });

  test('axe : aucune violation sérieuse', async ({ page }) => {
    await page.goto('/species/2435099');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sources' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});
