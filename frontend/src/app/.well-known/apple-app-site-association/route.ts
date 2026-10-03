import { buildAppleAppSiteAssociation, readAppLinksEnv, wellKnownResponse } from '@/lib/app-links';
import { routing } from '../../../../i18n/routing';

/**
 * Universal Links iOS (W6-09) : `/.well-known/apple-app-site-association` (JSON, sans extension).
 * Généré au build depuis APPLE_TEAM_ID / IOS_BUNDLE_ID ; 404 si une valeur manque ou est invalide.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  return wellKnownResponse(buildAppleAppSiteAssociation(readAppLinksEnv(), routing.locales));
}
