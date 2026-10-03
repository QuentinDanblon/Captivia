import { createPrivateKey } from 'crypto';

/**
 * Configuration du push natif (W6-07) : Firebase Cloud Messaging, API HTTP v1.
 *
 * - `FCM_SERVICE_ACCOUNT_JSON` : clé JSON d'un compte de service Google du projet Firebase,
 *   encodée en base64 (`base64 -w0 cle.json`) ; le JSON brut est aussi accepté.
 * - `FCM_PROJECT_ID` (facultatif) : identifiant du projet Firebase ; par défaut `project_id` du JSON.
 *
 * Variable absente : le canal natif est désactivé (journal « info » au démarrage, aucune erreur),
 * comme le Web Push sans clés VAPID. Variable présente mais invalide : canal désactivé, journal
 * d'erreur (jamais le contenu de la clé).
 */
export interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  /** Clé privée PEM (PKCS#8) du compte de service. */
  privateKey: string;
}

export type FcmConfigResult =
  | { config: FcmServiceAccount }
  | { config: null; reason: 'absent' | 'invalid'; detail?: string };

/** Identifiant de projet Google Cloud : 6 à 30 caractères, minuscules, chiffres et tirets. */
export const FCM_PROJECT_ID_REGEX = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function decodeServiceAccount(raw: string): unknown {
  const value = raw.trim();
  const json = value.startsWith('{')
    ? value
    : Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(json);
}

const invalid = (detail: string): FcmConfigResult => ({
  config: null,
  reason: 'invalid',
  detail,
});

/** Lit et valide la configuration FCM depuis l'environnement (fonction pure, testable). */
export function readFcmConfig(
  env: NodeJS.ProcessEnv = process.env,
): FcmConfigResult {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return { config: null, reason: 'absent' };

  let parsed: unknown;
  try {
    parsed = decodeServiceAccount(raw);
  } catch {
    return invalid(
      'FCM_SERVICE_ACCOUNT_JSON illisible (JSON ou base64 de JSON attendu)',
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalid('FCM_SERVICE_ACCOUNT_JSON : objet JSON attendu');
  }
  const json = parsed as Record<string, unknown>;
  if (json.type !== undefined && json.type !== 'service_account') {
    return invalid('FCM_SERVICE_ACCOUNT_JSON : type "service_account" attendu');
  }

  const clientEmail =
    typeof json.client_email === 'string' ? json.client_email.trim() : '';
  if (!EMAIL_REGEX.test(clientEmail)) {
    return invalid('FCM_SERVICE_ACCOUNT_JSON : client_email manquant');
  }

  const privateKey =
    typeof json.private_key === 'string'
      ? json.private_key.replace(/\\n/g, '\n')
      : '';
  try {
    if (!privateKey) throw new Error('absente');
    const key = createPrivateKey(privateKey);
    if (key.asymmetricKeyType !== 'rsa') throw new Error('type');
  } catch {
    return invalid('FCM_SERVICE_ACCOUNT_JSON : private_key RSA invalide');
  }

  const projectId =
    env.FCM_PROJECT_ID?.trim() ||
    (typeof json.project_id === 'string' ? json.project_id.trim() : '');
  if (!FCM_PROJECT_ID_REGEX.test(projectId)) {
    return invalid(
      'identifiant de projet Firebase invalide (FCM_PROJECT_ID ou project_id)',
    );
  }

  return { config: { projectId, clientEmail, privateKey } };
}
