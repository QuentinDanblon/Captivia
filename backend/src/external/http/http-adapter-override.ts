import type { AxiosAdapter } from 'axios';

/**
 * Point d'injection POUR LES TESTS : remplace le transport HTTP du client externe
 * partagé (jamais utilisé en production — `undefined` par défaut).
 *
 * `test/setup.ts` y branche un adaptateur de fixtures hors-ligne : aucune suite Jest ne
 * peut alors joindre GBIF, Open Pet Food Facts, etc. (déterminisme, pas de timeout réseau).
 * La résilience (retry, disjoncteur, timeout) s'exécute, elle, normalement par-dessus.
 */
let override: AxiosAdapter | undefined;

export function setExternalHttpAdapterOverride(
  adapter: AxiosAdapter | undefined,
): void {
  override = adapter;
}

export function getExternalHttpAdapterOverride(): AxiosAdapter | undefined {
  return override;
}
