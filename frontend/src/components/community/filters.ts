import type { CommunityCategory, CommunityPostType } from '@/lib/community';

/**
 * Filtres du fil reflétés dans l'URL, en français comme les chemins (`?type=questions&espece=reptiles`) :
 * un retour depuis une publication retrouve le même fil.
 */
export const TYPE_SLUGS: Record<CommunityPostType, string> = { PHOTO: 'photos', QUESTION: 'questions' };

export const CATEGORY_SLUGS: Record<CommunityCategory, string> = {
  MAMMAL: 'mammiferes',
  BIRD: 'oiseaux',
  REPTILE: 'reptiles',
  FISH: 'poissons',
  AMPHIBIAN: 'amphibiens',
  ARACHNID: 'arachnides',
  INSECT: 'insectes',
  OTHER: 'autres',
};

function fromSlug<K extends string>(map: Record<K, string>, slug: string | null): K | null {
  if (!slug) return null;
  const found = (Object.keys(map) as K[]).find((key) => map[key] === slug);
  return found ?? null;
}

export function parseFeedFilters(params: URLSearchParams): { type: CommunityPostType | null; category: CommunityCategory | null } {
  return {
    type: fromSlug(TYPE_SLUGS, params.get('type')),
    category: fromSlug(CATEGORY_SLUGS, params.get('espece')),
  };
}

export function feedQuery(type: CommunityPostType | null, category: CommunityCategory | null): string {
  const params = new URLSearchParams();
  if (type) params.set('type', TYPE_SLUGS[type]);
  if (category) params.set('espece', CATEGORY_SLUGS[category]);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
