/**
 * Drapeau de build de la communauté (module pur : importable par les composants serveur, comme la
 * landing, sans tirer le client de l'API).
 *
 * `NEXT_PUBLIC_COMMUNITY_ENABLED` (lu au build) :
 *  - `false` → volet coupé : « Bientôt » partout, aucune requête de détection ;
 *  - `true` → la landing mène à la communauté ; l'app vérifie quand même l'API ;
 *  - absent (défaut) → l'app vérifie l'API ; la landing reste « Bientôt ».
 */
export type CommunityBuildFlag = 'on' | 'off' | 'auto';

export function parseCommunityFlag(raw: string | null | undefined): CommunityBuildFlag {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'false' || value === '0' || value === 'off') return 'off';
  if (value === 'true' || value === '1' || value === 'on') return 'on';
  return 'auto';
}

/** Accès statique : Next.js inline la variable dans le bundle. */
export const COMMUNITY_BUILD_FLAG: CommunityBuildFlag = parseCommunityFlag(process.env.NEXT_PUBLIC_COMMUNITY_ENABLED);
