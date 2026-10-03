/**
 * Limites de débit (@nestjs/throttler), par IP et par fenêtre de 60 s.
 * - GLOBAL_THROTTLE : filet global (APP_GUARD) pour toutes les routes. 300 / min : une fiche
 *   animal déclenche ~17 requêtes, et une IP est souvent partagée (NAT d'un foyer, d'une
 *   entreprise, CGNAT mobile) ; les routes sensibles gardent leurs propres limites strictes
 *   (connexion, inscription, mots de passe : AuthRateLimitGuard 10 / min ; invités 5 / h ;
 *   jetons de push 30 / min) ;
 * - EXTERNAL_API_THROTTLE : plus strict (@Throttle) sur les contrôleurs qui déclenchent
 *   des appels vers des API tierces (amplification / quotas fournisseurs) ;
 * - SPECIES_PAGE_THROTTLE : routes appelées à chaque ouverture d'une fiche (onglet
 *   Alimentation : `/food/species/:name`, réponses en cache) : 120 / min.
 *
 * En NODE_ENV=test les limites sont relevées très haut pour que les suites e2e
 * (nombreuses requêtes depuis la même IP) ne tombent pas en 429 ; la production
 * n'est pas affaiblie.
 */
const IS_TEST = process.env.NODE_ENV === 'test';
const TEST_LIMIT = 1_000_000;
const WINDOW_MS = 60_000;

export const GLOBAL_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 300;
export const EXTERNAL_API_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 20;
export const SPECIES_PAGE_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 120;

export const GLOBAL_THROTTLE = { ttl: WINDOW_MS, limit: GLOBAL_THROTTLE_LIMIT };

/** À utiliser avec `@Throttle(EXTERNAL_API_THROTTLE)` sur un contrôleur ou une route. */
export const EXTERNAL_API_THROTTLE = {
  default: { ttl: WINDOW_MS, limit: EXTERNAL_API_THROTTLE_LIMIT },
};

/** À utiliser avec `@Throttle(SPECIES_PAGE_THROTTLE)` sur une route lue à chaque fiche. */
export const SPECIES_PAGE_THROTTLE = {
  default: { ttl: WINDOW_MS, limit: SPECIES_PAGE_THROTTLE_LIMIT },
};

/**
 * Enregistrement / retrait d'un jeton de push natif (W6-07) : l'app l'envoie au lancement et à
 * chaque retour au premier plan ; 30 requêtes / min / IP suffisent largement.
 */
export const DEVICE_TOKEN_THROTTLE_LIMIT = IS_TEST ? TEST_LIMIT : 30;
export const DEVICE_TOKEN_THROTTLE = {
  default: { ttl: WINDOW_MS, limit: DEVICE_TOKEN_THROTTLE_LIMIT },
};
