import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

/** Sous-ensemble utile du résultat de `axe.run`. */
export interface AxeViolation {
  id: string;
  impact?: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  nodes: { target: unknown[]; html: string }[];
}

let cachedSource: string | undefined;

/**
 * Source d'axe-core : paquet installé (`require.resolve('axe-core')`, présent via
 * eslint-config-next), sinon copie locale `e2e/support/axe.min.js`.
 */
function axeSource(): string {
  if (cachedSource) return cachedSource;
  let file: string | undefined;
  try {
    file = require.resolve('axe-core/axe.min.js');
  } catch {
    const local = path.join(__dirname, 'axe.min.js');
    if (existsSync(local)) file = local;
  }
  if (!file) {
    throw new Error("axe-core introuvable : installez-le (npm i -D axe-core) ou placez axe.min.js dans e2e/support/.");
  }
  cachedSource = readFileSync(file, 'utf8');
  return cachedSource;
}

/**
 * Lance axe-core sur la page courante et renvoie les violations.
 * L'injection passe par `page.evaluate` (CDP) : la CSP de l'application, qui interdit les
 * scripts inline, ne s'applique pas — on teste donc l'application avec sa vraie CSP.
 */
export async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.evaluate(axeSource());
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target, html: n.html.slice(0, 200) })),
    }));
  });
}
