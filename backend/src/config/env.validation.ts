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
  /** Mode invité : jours d'inactivité avant purge d'un invité non converti (défaut 90). */
  GUEST_RETENTION_DAYS: Joi.number().integer().min(1).max(3650).default(90),
  /** Mode invité : "false" désactive la purge planifiée des invités inactifs. */
  GUEST_PURGE_ENABLED: Joi.string().valid('true', 'false').default('true'),
  /**
   * Maintenance quotidienne (W2-08) : "false" suspend la purge des jetons expirés, des refresh
   * tokens périmés et des événements de rappel de plus de 90 jours (docs/RUNBOOK.md).
   */
  MAINTENANCE_ENABLED: Joi.string().valid('true', 'false').default('true'),
  GOOGLE_PLAY_PACKAGE_NAME: Joi.string().allow('').optional(),
  /**
   * Intégrations externes (W3-05) — TOUTES optionnelles :
   * - Species+ (CITES/UE) exige un jeton : absent, /speciesplus/* répond 503
   *   INTEGRATION_DISABLED et la fiche législation indique `speciesPlus.status = "disabled"` ;
   * - PubMed (NCBI) est public : la clé et l'e-mail relèvent seulement le quota (3 → 10 req/s) ;
   * - Amazon : aucune intégration (route /amazon/* retirée, décision D-09), donc aucune variable.
   */
  SPECIESPLUS_API_TOKEN: Joi.string().trim().allow('').optional(),
  NCBI_API_KEY: Joi.string().trim().allow('').optional(),
  NCBI_EMAIL: Joi.string().trim().allow('').optional(),
  /**
   * Communauté (volet social, phase 1). Désactivée par défaut : toutes les routes /community/*
   * répondent 404. En production, l'activer exige le pilote de médias `s3` (disque Render
   * éphémère) et une URL publique des médias en https.
   */
  COMMUNITY_ENABLED: Joi.string().valid('true', 'false').default('false'),
  /** Signalements distincts déclenchant le masquage automatique d'un contenu. */
  COMMUNITY_HIDE_THRESHOLD: Joi.number().integer().min(1).max(100).default(3),
  COMMUNITY_POSTS_PER_HOUR: Joi.number().integer().min(1).max(1000).default(5),
  COMMUNITY_COMMENTS_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(5),
  COMMUNITY_UPLOADS_PER_HOUR: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(30),
  /** Point de contact DSA cité dans les notifications de modération. */
  COMMUNITY_CONTACT_EMAIL: Joi.string().trim().email().allow('').optional(),
  /** Stockage des médias : `local` (dev/tests, MEDIA_LOCAL_DIR) ou `s3` (Cloudflare R2, S3…). */
  MEDIA_DRIVER: Joi.when('NODE_ENV', {
    is: isProduction,
    then: Joi.when('COMMUNITY_ENABLED', {
      is: 'true',
      then: Joi.string().valid('s3').required().messages({
        'any.only':
          '"MEDIA_DRIVER" doit valoir "s3" en production quand COMMUNITY_ENABLED=true (disque éphémère)',
        'any.required':
          '"MEDIA_DRIVER" doit valoir "s3" en production quand COMMUNITY_ENABLED=true (disque éphémère)',
      }),
      otherwise: Joi.string().valid('local', 's3').default('local'),
    }),
    otherwise: Joi.string().valid('local', 's3').default('local'),
  }),
  MEDIA_LOCAL_DIR: Joi.string().trim().allow('').optional(),
  /** Taille maximale d'une image téléversée (octets, défaut 8 Mo). */
  MEDIA_MAX_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(8 * 1024 * 1024),
  /** Base des URL publiques des images (domaine public du bucket R2, ou l'API en local). */
  MEDIA_PUBLIC_BASE_URL: Joi.when('MEDIA_DRIVER', {
    is: 's3',
    then: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .allow('')
      .optional(),
  }),
  MEDIA_BUCKET: Joi.when('MEDIA_DRIVER', {
    is: 's3',
    then: Joi.string().trim().min(3).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  /** Point d'accès S3 (R2 : https://<ACCOUNT_ID>.r2.cloudflarestorage.com ; vide pour AWS). */
  S3_ENDPOINT: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .allow('')
    .optional(),
  S3_REGION: Joi.string().trim().default('auto'),
  S3_ACCESS_KEY_ID: Joi.when('MEDIA_DRIVER', {
    is: 's3',
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  S3_SECRET_ACCESS_KEY: Joi.when('MEDIA_DRIVER', {
    is: 's3',
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').default('false'),
});
