import { expect, runAxe, signIn, signInAsGuest, test, fixture, type MockAnimal } from '../support/test';

/** Parcours publics : accessibles sans session. */
const PUBLIC_PAGES = [
  '/',
  '/en',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password?token=e2e',
  '/verifier-email',
  '/species/2435099',
  '/especes',
  '/mentions-legales',
  '/confidentialite',
  '/cgu',
  '/sources-et-licences',
  '/transparency',
  '/suppression-compte',
  '/page-introuvable-axe',
  '/animal-public/kaa-e2e',
];

/** Parcours authentifiés. */
const PRIVATE_PAGES = [
  '/mes-animaux',
  '/mes-animaux/liste',
  '/mes-animaux/animal-e2e-1',
  '/agenda',
  '/parametres',
  '/parametres/compte',
  '/parametres/notifications',
  '/parametres/grade',
  '/parametres/abonnement',
  '/magasin',
  '/mes-animaux/animal-e2e-1/carnet',
];

/** Parcours invité (essai sans compte) : premier animal, puis sauvegarde des données. */
const GUEST_PAGES = ['/mes-animaux', '/sauvegarder'];

/** Rendu stable : le contenu principal de chaque page est présent avant l'analyse. */
async function waitForContent(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Échec sur toute violation « serious » ou « critical » ; les mineures restent annotées dans le rapport. */
async function expectNoSeriousViolations(page: import('@playwright/test').Page, label: string) {
  const violations = await runAxe(page);
  const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const others = violations.filter((v) => v.impact !== 'critical' && v.impact !== 'serious');
  if (others.length > 0) {
    test.info().annotations.push({
      type: 'axe',
      description: `${label} : ${others.map((v) => `${v.id} (${v.impact})`).join(', ')}`,
    });
  }
  expect(blocking, `${label} : violations axe sérieuses ou critiques`).toEqual([]);
}

test.describe('Accessibilité (axe-core)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} : aucune violation sérieuse`, async ({ page }) => {
      await page.goto(path);
      await waitForContent(page);
      await expectNoSeriousViolations(page, path);
    });
  }

  test.describe('connecté', () => {
    test.beforeEach(async ({ page, api }) => {
      await signIn(page);
      api.animals = [fixture<MockAnimal>('animal')];
    });

    for (const path of PRIVATE_PAGES) {
      test(`${path} : aucune violation sérieuse`, async ({ page }) => {
        await page.goto(path);
        await waitForContent(page);
        await expectNoSeriousViolations(page, path);
      });
    }
  });

  test.describe('invité', () => {
    test.beforeEach(async ({ page, api }) => {
      await signInAsGuest(page);
      api.animals = [];
    });

    for (const path of GUEST_PAGES) {
      test(`${path} (invité) : aucune violation sérieuse`, async ({ page }) => {
        await page.goto(path);
        await waitForContent(page);
        await expectNoSeriousViolations(page, `${path} (invité)`);
      });
    }
  });

  // Contrastes en sombre : les jetons sont redéfinis sous prefers-color-scheme, on vérifie l'encre.
  test.describe('sombre', () => {
    test.use({ colorScheme: 'dark' });

    for (const path of ['/', '/login', '/species/2435099', '/mentions-legales', '/animal-public/kaa-e2e']) {
      test(`${path} (sombre) : aucune violation sérieuse`, async ({ page }) => {
        await page.goto(path);
        await waitForContent(page);
        await expectNoSeriousViolations(page, `${path} (sombre)`);
      });
    }

    for (const path of ['/mes-animaux', '/mes-animaux/animal-e2e-1', '/agenda', '/parametres/abonnement']) {
      test(`${path} (sombre, connecté) : aucune violation sérieuse`, async ({ page, api }) => {
        await signIn(page);
        api.animals = [fixture<MockAnimal>('animal')];
        await page.goto(path);
        await waitForContent(page);
        await expectNoSeriousViolations(page, `${path} (sombre)`);
      });
    }
  });

  test.describe('thème sombre forcé', () => {
    test.use({ colorScheme: 'light' });

    for (const path of ['/', '/parametres']) {
      test(`${path} (sombre choisi) : aucune violation sérieuse`, async ({ page, api }) => {
        await page.addInitScript(() => localStorage.setItem('captivia.theme', 'dark'));
        if (path === '/parametres') {
          await signIn(page);
          api.animals = [fixture<MockAnimal>('animal')];
        }
        await page.goto(path);
        await waitForContent(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expectNoSeriousViolations(page, `${path} (sombre choisi)`);
      });
    }
  });
});
