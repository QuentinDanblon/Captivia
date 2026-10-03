import { buildAssetLinks, readAppLinksEnv, wellKnownResponse } from '@/lib/app-links';

/**
 * App Links Android (W6-09) : `/.well-known/assetlinks.json`. Généré au build depuis
 * ANDROID_PACKAGE_NAME / ANDROID_SHA256_CERT_FINGERPRINTS ; 404 si une valeur manque ou est invalide.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  return wellKnownResponse(buildAssetLinks(readAppLinksEnv()));
}
