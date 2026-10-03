import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { communityEnabled } from './community.config';

/**
 * Premier garde de toutes les routes /community/* : volet désactivé (`COMMUNITY_ENABLED` absent
 * ou différent de "true") → 404, avant même l'authentification. Les routes n'existent pas pour
 * le client, comme si le module n'était pas chargé.
 */
@Injectable()
export class CommunityEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!communityEnabled()) throw new NotFoundException();
    return true;
  }
}
