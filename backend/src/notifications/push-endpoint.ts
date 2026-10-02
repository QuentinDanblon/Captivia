import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

/**
 * Services Web Push autorisés (revue de sécurité, constat 2 : SSRF aveugle).
 *
 * Un endpoint push est une URL fournie par le navigateur, que le serveur appelle ensuite (POST
 * chiffré). Sans liste blanche, un utilisateur pouvait faire appeler par le backend une adresse
 * interne (127.0.0.1, métadonnées cloud, services privés) et s'en servir comme oracle.
 *
 * - `exact` : hôte exact ;
 * - `suffix` : sous-domaine strict (`*.push.apple.com` accepte `web.push.apple.com`, pas
 *   `push.apple.com` ni `evilpush.apple.com`).
 */
const EXACT_HOSTS = new Set(['fcm.googleapis.com']);
const HOST_SUFFIXES = [
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
  '.wns.windows.com',
];

/** Longueur maximale d'un endpoint (alignée sur le DTO). */
export const PUSH_ENDPOINT_MAX_LENGTH = 500;

/**
 * Vrai si `endpoint` désigne un service push connu : https uniquement, port par défaut (443),
 * sans identifiants, hôte dans la liste blanche. Vérifié à l'abonnement (DTO) ET avant chaque
 * envoi (`WebPushSender.deliver`), pour les lignes enregistrées avant ce contrôle.
 */
export function isAllowedPushEndpoint(endpoint: unknown): boolean {
  if (
    typeof endpoint !== 'string' ||
    endpoint.length === 0 ||
    endpoint.length > PUSH_ENDPOINT_MAX_LENGTH
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // `URL` normalise « :443 » en port vide pour https : tout port explicite non standard est refusé.
  if (url.protocol !== 'https:' || url.port !== '') return false;
  if (url.username !== '' || url.password !== '') return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length,
  );
}

/** Décorateur class-validator : endpoint d'un service Web Push autorisé. */
export function IsAllowedPushEndpoint(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isAllowedPushEndpoint',
      validator: {
        validate: (value: unknown) => isAllowedPushEndpoint(value),
        defaultMessage: buildMessage(
          (each) =>
            `${each}$property must be an https URL of a supported Web Push service`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
