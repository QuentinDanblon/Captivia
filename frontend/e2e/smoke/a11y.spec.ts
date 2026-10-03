import { expect, runAxe, signIn, test, fixture, type MockAnimal } from '../support/test';

/** Parcours publics : accessibles sans session. */
const PUBLIC_PAGES = [
  '/',
  '/en',
  '/login',
  '/register',
  '/species/2435099',
  '/especes',
  '/mentions-legales',
  '/confidentialite',
  '/cgu',
  '/sources-et-licences',
  '/transparency',
  '/suppression-compte',
  '/page-introuvable-axe',
];

/** Parcours authentifiés. */
const PRIVATE_PAGES = ['/mes-animaux', '/mes-animaux/liste', '/mes-animaux/animal-e2e-1', '/parametres/compte'];

/** Rendu stable : le contenu principal de chaque page est présent avant l'analyse. */
async function waitForContent(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function expectNoCriticalViolations(page: import('@playwright/test').Page, label: string) {
  const violations = await runAxe(page);
  const critical = violations.filter((v) => v.impact === 'critical');
  // Les violations moins graves restent visibles dans le rapport sans faire échouer le smoke.
  const others = violations.filter((v) => v.impact !== 'critical');
  if (others.length > 0) {
    test.info().annotations.push({
      type: 'axe',
      description: `${label} : ${others.map((v) => `${v.id} (${v.impact})`).join(', ')}`,
    });
  }
  expect(critical, `${label} : violations axe critiques`).toEqual([]);
}

test.describe('Accessibilité (axe-core)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} : aucune violation critique`, async ({ page }) => {
      await page.goto(path);
      await waitForContent(page);
      await expectNoCriticalViolations(page, path);
    });
  }

  test.describe('connecté', () => {
    test.beforeEach(async ({ page, api }) => {
      await signIn(page);
      api.animals = [fixture<MockAnimal>('animal')];
    });

    for (const path of PRIVATE_PAGES) {
      test(`${path} : aucune violation critique`, async ({ page }) => {
        await page.goto(path);
        await waitForContent(page);
        await expectNoCriticalViolations(page, path);
      });
    }
  });
});
