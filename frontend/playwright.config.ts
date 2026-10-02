import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, defineConfig, devices } from '@playwright/test';

/**
 * Deux familles de tests (voir e2e/README ci-dessous) :
 *
 *  - SMOKE (`e2e/smoke`, projets `smoke` + `smoke-mobile`) : le frontend de production
 *    (build standalone, e2e/support/serve.js) face à une API SIMULÉE (page.route + e2e/fixtures). Aucun backend ni base
 *    de données : déterministe, bloquant en CI (job « e2e » de .github/workflows/ci.yml).
 *      NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run build
 *      npx playwright test --project=smoke --project=smoke-mobile
 *    L'URL de l'API doit être celle du build : elle est inlinée dans le bundle et dans la CSP.
 *
 *  - INTÉGRATION (`e2e/integration`, projets `chromium` + `Mobile Chrome`) : suppose un vrai
 *    backend + base seedée sur :3001. Hors CI. E2E_INTEGRATION=1 démarre `next dev` sur :3000 ;
 *    PLAYWRIGHT_SKIP_WEBSERVER=1 suppose un frontend déjà lancé.
 */

const SMOKE_PORT = Number(process.env.E2E_SMOKE_PORT ?? 3100);
const SMOKE_URL = `http://localhost:${SMOKE_PORT}`;
const INTEGRATION_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/**
 * Chromium de secours : si la révision attendue par cette version de Playwright n'est pas
 * installée (environnement figé, sans `playwright install`), on retombe sur celle présente
 * dans PLAYWRIGHT_BROWSERS_PATH. Sans effet quand le navigateur attendu existe (cas de la CI).
 */
function fallbackChromium(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // executablePath() peut lever si le navigateur n'est pas résolu : on cherche un repli.
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((dir) => /^chromium_headless_shell-\d+$|^chromium-\d+$/.test(dir))
    .sort()
    .reverse()
    .flatMap((dir) => [
      path.join(root, dir, 'chrome-linux', 'headless_shell'),
      path.join(root, dir, 'chrome-linux', 'chrome'),
    ]);
  return candidates.find((file) => existsSync(file));
}

const executablePath = fallbackChromium();
const launchOptions = executablePath ? { executablePath } : {};

// « localhost » est résolu en IPv4 (le serveur écoute sur 127.0.0.1) : pas d'aller-retour ::1 / 127.0.0.1.
const smokeLaunchOptions = {
  ...launchOptions,
  args: ['--host-resolver-rules=MAP localhost 127.0.0.1'],
};
const smokeUse = { baseURL: SMOKE_URL, locale: 'fr-FR', launchOptions: smokeLaunchOptions };
const integrationUse = { baseURL: INTEGRATION_URL, launchOptions };
const integrationMatch = ['integration/**/*.spec.ts', 'manual-modals-flow.spec.ts'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'smoke',
      testMatch: 'smoke/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], ...smokeUse },
    },
    {
      name: 'smoke-mobile',
      testMatch: 'smoke/**/*.spec.ts',
      use: { ...devices['Pixel 5'], ...smokeUse },
    },
    {
      name: 'chromium',
      testMatch: integrationMatch,
      use: { ...devices['Desktop Chrome'], ...integrationUse },
    },
    {
      name: 'Mobile Chrome',
      testMatch: integrationMatch,
      use: { ...devices['Pixel 5'], ...integrationUse },
    },
  ],

  /* Frontend de production pour le smoke (le build est une étape préalable, cf. en-tête). */
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: 'node e2e/support/serve.js',
          url: SMOKE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          env: { PORT: String(SMOKE_PORT) },
          stdout: 'pipe',
          stderr: 'pipe',
        },
        ...(process.env.E2E_INTEGRATION
          ? [
              {
                command: 'npm run dev',
                url: 'http://localhost:3000',
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]
          : []),
      ],
});
