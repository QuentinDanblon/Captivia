/**
 * Limites de débit (@nestjs/throttler), par IP et par fenêtre de 60 s.
 * - GLOBAL_THROTTLE : filet global (APP_GUARD) pour toutes les routes ;
 * - EXTERNAL_API_THROTTLE : plus strict (@Throttle) sur les contrôleurs qui déclenchent
 *   des appels vers des API tierces (amplification / quotas fournisseurs).
 *
 * En NODE_ENV=test les limites sont relevées très haut pour que les suites e2e
 * (nombreuses requêtes depuis la même IP) ne tombent pas en 429 ; la production
 * n'est pas affaiblie.
 */
const IS_TEST = process.env.NODE_ENV === 'test';
const TEST_LIMIT = 1_000_000;
const WINDOW_MS = 60_000;

export const GLOBAL_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 120;
export const EXTERNAL_API_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 20;

export const GLOBAL_THROTTLE = { ttl: WINDOW_MS, limit: GLOBAL_THROTTLE_LIMIT };

/** À utiliser avec `@Throttle(EXTERNAL_API_THROTTLE)` sur un contrôleur ou une route. */
export const EXTERNAL_API_THROTTLE = {
  default: { ttl: WINDOW_MS, limit: EXTERNAL_API_THROTTLE_LIMIT },
};

/**
 * Enregistrement / retrait d'un jeton de push natif (W6-07) : l'app l'envoie au lancement et à
 * chaque retour au premier plan ; 30 requêtes / min / IP suffisent largement.
 */
export const DEVICE_TOKEN_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 30;
export const DEVICE_TOKEN_THROTTLE = {
  default: { ttl: WINDOW_MS, limit: DEVICE_TOKEN_THROTTLE_LIMIT },
};
