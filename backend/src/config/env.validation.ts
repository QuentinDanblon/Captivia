import * as Joi from 'joi';

/**
 * Valeurs d'exemple publiées dans le dépôt (.env.example, docker-compose, README…).
 * Elles sont publiques : un JWT_SECRET qui leur ressemble permettrait à n'importe qui
 * de forger des tokens. Refusées en production.
 */
export const KNOWN_EXAMPLE_JWT_SECRETS: readonly string[] = [
  'dev-only-change-me-captivia-docker-secret-32-chars',
  'change-me-to-a-strong-random-secret-at-least-32-chars',
];

const EXAMPLE_SECRET_PREFIXES = ['dev-only', 'change-me'];

export function isExampleJwtSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    KNOWN_EXAMPLE_JWT_SECRETS.includes(normalized) ||
    EXAMPLE_SECRET_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

const isProduction = Joi.valid('production');

const jwtSecretInProduction = Joi.string()
  .min(32)
  .required()
  .custom((value: string, helpers) =>
    isExampleJwtSecret(value) ? helpers.error('captivia.exampleSecret') : value,
  )
  .messages({
    'captivia.exampleSecret':
      '"JWT_SECRET" ne doit pas être une valeur d\'exemple (générez-en un : openssl rand -base64 48)',
    'string.min':
      '"JWT_SECRET" doit faire au moins 32 caractères en production',
  });

/** https obligatoire ; http toléré uniquement vers le loopback (stack Docker locale). */
const frontendUrlInProduction = Joi.string()
  .uri({ scheme: ['http', 'https'] })
  .required()
  .custom((value: string, helpers) => {
    try {
      const url = new URL(value);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(
        url.hostname,
      );
      if (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) {
        return value;
      }
    } catch {
      /* géré par helpers.error ci-dessous */
    }
    return helpers.error('captivia.https');
  })
  .messages({
    'captivia.https': '"FRONTEND_URL" doit être une URL https en production',
  });

/**
 * Schéma de validation des variables d'environnement (ConfigModule.forRoot).
 * - hors production : comportement historique (JWT_SECRET ≥ 16, CORS/FRONTEND_URL optionnels) ;
 * - en production : secrets forts et configuration réseau explicite obligatoires.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: isProduction,
    then: jwtSecretInProduction,
    otherwise: Joi.string().min(16).required(),
  }),
  PORT: Joi.number().default(3001),
  HOST: Joi.string().optional(),
  TRUST_PROXY: Joi.alternatives()
    .try(
      Joi.string().valid('true', 'false'),
      Joi.number().integer().min(0).max(10),
    )
    .optional(),
  CORS_ORIGIN: Joi.when('NODE_ENV', {
    is: isProduction,
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  FRONTEND_URL: Joi.when('NODE_ENV', {
    is: isProduction,
    then: frontendUrlInProduction,
    otherwise: Joi.string().allow('').optional(),
  }),
  PUBLIC_WEB_URL: Joi.string().uri().allow('').optional(),
  CACHE_TYPE: Joi.string()
    .valid('memory', 'redis', 'memcached')
    .default('memory'),
  REDIS_ENABLED: Joi.string().valid('true', 'false').default('false'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  /** Achats intégrés (W6-08) : active l'exigence du secret webhook RevenueCat en production. */
  IAP_ENABLED: Joi.string().valid('true', 'false').default('false'),
  REVENUECAT_WEBHOOK_SECRET: Joi.when('NODE_ENV', {
    is: isProduction,
    then: Joi.when('IAP_ENABLED', {
      is: 'true',
      then: Joi.string().trim().min(32).required(),
      otherwise: Joi.string().allow('').optional(),
    }),
    otherwise: Joi.string().allow('').optional(),
  }),
  REVENUECAT_ENTITLEMENT_ID: Joi.string().trim().default('premium'),
  GOOGLE_PLAY_PACKAGE_NAME: Joi.string().allow('').optional(),
});
