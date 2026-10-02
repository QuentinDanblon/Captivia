/** Sujet VAPID par défaut (mailto: ou https:) si `VAPID_SUBJECT` est absent. */
export const DEFAULT_VAPID_SUBJECT = 'mailto:contact@captivia.com';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Lit la configuration VAPID depuis l'environnement. Renvoie null si l'une des deux clés est
 * absente (le push est alors désactivé). Générer les clés : `npm run vapid:generate`.
 */
export function readVapidConfig(
  env: NodeJS.ProcessEnv = process.env,
): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT,
  };
}
