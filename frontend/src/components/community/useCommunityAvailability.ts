'use client';

import { useSyncExternalStore } from 'react';
import {
  COMMUNITY_BUILD_FLAG,
  getCommunityAvailability,
  subscribeCommunityAvailability,
  type CommunityAvailability,
} from '@/lib/community';

/**
 * Disponibilité du volet (drapeau de build + sonde de l'API, voir src/lib/community.ts).
 * Rendu serveur et hydratation : `unknown` (aucun lien tant que l'API n'a pas répondu), sauf volet
 * coupé au build (`unavailable` d'emblée, sans requête).
 */
export function useCommunityAvailability(): CommunityAvailability {
  return useSyncExternalStore(subscribeCommunityAvailability, getCommunityAvailability, () =>
    COMMUNITY_BUILD_FLAG === 'off' ? 'unavailable' : 'unknown',
  );
}
