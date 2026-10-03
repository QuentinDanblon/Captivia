import type { PhotoKey } from '@/content/photos';

export const GUIDE_CATEGORIES = [
  { id: 'dogs', photo: 'dogGoldenRetriever', className: 'Mammalia' },
  { id: 'cats', photo: 'catStraw', className: 'Mammalia' },
  { id: 'rodents', photo: 'guineaPig', className: 'Mammalia' },
  { id: 'rabbits', photo: 'rabbitStraw', className: 'Mammalia' },
  { id: 'mammals', photo: 'horse', className: 'Mammalia' },
  { id: 'birds', photo: 'cockatiels', className: 'Aves' },
  { id: 'reptiles', photo: 'beardedDragon', className: 'Reptilia' },
  { id: 'amphibians', photo: 'axolotl', className: 'Amphibia' },
  { id: 'freshwater', photo: 'neonTetra', className: 'Actinopterygii' },
  { id: 'marine', photo: null, className: 'Actinopterygii' },
  { id: 'insects', photo: 'stickInsect', className: 'Insecta' },
  { id: 'arachnids', photo: 'emperorScorpion', className: 'Arachnida' },
] as const satisfies ReadonlyArray<{ id: string; photo: PhotoKey | null; className: string }>;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]['id'];
export function isGuideCategory(value: string | null): value is GuideCategory {
  return GUIDE_CATEGORIES.some(({ id }) => id === value);
}
export function guidePath(speciesId?: number | string) {
  return speciesId == null ? '/guides' : `/guides?species=${encodeURIComponent(String(speciesId))}`;
}

/** Fish habitats remain an explicit choice: taxonomy cannot establish salinity. */
export function guideCategoryForSpecies(species: {
  scientificName?: string; canonicalName?: string; class?: string;
  profile?: { category?: string; subcategory?: string | null; scientificName?: string } | null;
}): GuideCategory | null {
  const name = (species.profile?.scientificName || species.scientificName || species.canonicalName || '').toLowerCase();
  if (/^canis (lupus familiaris|familiaris)(?:\s|$)/.test(name)) return 'dogs';
  if (/^felis (catus|silvestris catus)(?:\s|$)/.test(name)) return 'cats';
  if (/^oryctolagus cuniculus(?:\s|$)/.test(name)) return 'rabbits';
  if (/^(cavia|cricetulus|mesocricetus|phodopus|mus musculus|rattus|chinchilla|octodon)\b/.test(name)) return 'rodents';
  const category = (species.class || species.profile?.category || '').toLowerCase();
  const groups: Record<string, GuideCategory> = {
    mammalia: 'mammals', mammifère: 'mammals', mammals: 'mammals',
    aves: 'birds', oiseau: 'birds', birds: 'birds',
    reptilia: 'reptiles', reptile: 'reptiles', reptiles: 'reptiles',
    amphibia: 'amphibians', amphibien: 'amphibians', amphibians: 'amphibians',
    insecta: 'insects', insecte: 'insects', insects: 'insects',
    arachnida: 'arachnids', arachnide: 'arachnids', arachnids: 'arachnids',
  };
  return groups[category] ?? null;
}
