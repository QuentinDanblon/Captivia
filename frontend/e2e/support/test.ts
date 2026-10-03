import { test as base, expect } from '@playwright/test';
import { API_ORIGIN, installMockApi, type MockApi } from './mock-api';

/**
 * `test` du projet smoke : chaque test dispose de
 *  - `api` : le backend simulé (voir mock-api.ts), installé AVANT toute navigation ;
 *  - une page hermétique (toute requête hors application / API simulée est coupée) ;
 *  - des garde-fous automatiques en fin de test : aucune requête API non simulée, aucune
 *    exception JavaScript non interceptée, aucune violation de Content-Security-Policy.
 */
export const test = base.extend<{ api: MockApi }>({
  api: [async ({ page, baseURL }, use) => {
    const appOrigin = new URL(baseURL ?? 'http://localhost:3100').origin;
    const pageErrors: string[] = [];
    const cspViolations: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /content security policy/i.test(message.text())) {
        cspViolations.push(message.text());
      }
    });

    // Hermétique : polices, analytics, etc. ne doivent jamais sortir (ni ralentir) les tests.
    await page.route(
      (url) => ![appOrigin, API_ORIGIN].includes(url.origin) && /^https?:$/.test(url.protocol),
      (route) => route.abort(),
    );
    const api = await installMockApi(page);

    await use(api);

    expect.soft(api.unmocked, 'requêtes API sans route simulée').toEqual([]);
    expect.soft(pageErrors, 'exceptions JavaScript non interceptées').toEqual([]);
    expect.soft(cspViolations, 'violations de Content-Security-Policy').toEqual([]);
  },
  // auto : sans cela le fixture (paresseux) n'est pas installé pour un test qui ne demande pas `api`.
  { auto: true },
  ],
});

export { expect };
export {
  signIn,
  signInAsGuest,
  VALID_PASSWORD,
  GUEST_TOKEN,
  UPGRADED_TOKEN,
  TAKEN_EMAIL,
  fixture,
  type MockAnimal,
  type MockAgendaItem,
} from './mock-api';
export { runAxe } from './axe';
