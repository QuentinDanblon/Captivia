/**
 * Espèces : photo sous licence libre, groupes de recherche, noms et rang (fiche espèce et recherche
 * de l'app). Fonctions pures, sans dépendance à React ni au réseau (testées dans __tests__/species.test.ts).
 */
import { toIucnCategory, type IucnCategory } from '@/components/ui/Badge';
import type { SilhouetteKind } from '@/components/ui/AnimalSilhouette';
import { isAllowedRemoteImage } from '@/lib/csp';

/* -------------------------------------------------------------------------- */
/* Photo d'espèce (GET /species/:id/media, médias GBIF)                        */
/* -------------------------------------------------------------------------- */

/** Média tel que renvoyé par l'API (transformation de GET gbif /species/:key/media). */
export interface SpeciesMediaItem {
  type?: string | null;
  format?: string | null;
  creator?: string | null;
  identifier?: string | null;
  url?: string | null;
  /** Page source du média (fiche iNaturalist, Wikimedia Commons…), quand GBIF la fournit. */
  references?: string | null;
  title?: string | null;
  license?: string | null;
}

/** Licence libre reconnue : libellé court affiché et texte officiel. */
export interface FreeLicense {
  label: string;
  url: string;
}

/** Photo affichable : source, auteur et licence libre vérifiés. */
export interface SpeciesPhoto {
  src: string;
  author: string;
  license: FreeLicense;
  /** Page à laquelle renvoie le crédit (page source, à défaut le fichier lui-même). */
  sourceUrl: string;
}

const CC_VERSION = /\b([1-4]\.0)\b/;

/**
 * Reconnaît une licence libre compatible avec l'affichage et le recadrage (DESIGN.md § 7) :
 * CC0, marque du domaine public, CC BY et CC BY-SA. Refuse NC, ND, « tous droits réservés » et
 * toute valeur inconnue. Accepte les URL Creative Commons (forme habituelle chez GBIF) comme les
 * libellés courts (« CC-BY-SA 4.0 », « CC0 »).
 */
export function parseFreeLicense(raw: string | null | undefined): FreeLicense | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  // Clauses non commerciales ou sans modification : incompatibles avec la diffusion dans l'app.
  if (/(^|[^a-z])(nc|nd)([^a-z]|$)|noncommercial|non-commercial|noderiv/.test(value)) {
    return null;
  }
  if (/all rights reserved|tous droits/.test(value)) return null;

  if (/publicdomain\/zero|(^|[^a-z])cc0([^a-z]|$)|cc-zero/.test(value)) {
    return { label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  }
  if (/publicdomain\/mark|public domain|domaine public|(^|[^a-z])pdm([^a-z]|$)/.test(value)) {
    return { label: 'PDM 1.0', url: 'https://creativecommons.org/publicdomain/mark/1.0/' };
  }

  const version = value.match(CC_VERSION)?.[1] ?? '4.0';
  const byUrl = value.match(/licenses\/(by(?:-sa)?)\//)?.[1];
  const byLabel = value.match(/(?:^|[^a-z])cc[\s_-]*(by(?:[\s_-]*sa)?)(?:[^a-z]|$)/)?.[1];
  const kind = (byUrl ?? byLabel)?.replace(/[\s_]+/g, '-');
  if (kind === 'by') return { label: `CC BY ${version}`, url: `https://creativecommons.org/licenses/by/${version}/` };
  if (kind === 'by-sa') return { label: `CC BY-SA ${version}`, url: `https://creativecommons.org/licenses/by-sa/${version}/` };
  return null;
}

/** URL https d'une ressource externe (http est relevé en https : la page est servie en https). */
function httpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isStillImage(item: SpeciesMediaItem): boolean {
  const type = (item.type ?? '').toLowerCase();
  const format = (item.format ?? '').toLowerCase();
  if (format) return format.startsWith('image/');
  return type === 'stillimage' || type === 'image' || type === 'photo';
}

/**
 * Première photo affichable d'une réponse /species/:id/media : image fixe, URL https servie par
 * un hôte autorisé en img-src (SPECIES_IMAGE_HOSTS, src/lib/csp.ts), auteur renseigné et licence
 * libre reconnue. Sans tout cela, `null` : la fiche montre la silhouette.
 */
export function pickSpeciesPhoto(media: unknown): SpeciesPhoto | null {
  const items = Array.isArray(media)
    ? media
    : media && typeof media === 'object' && Array.isArray((media as { results?: unknown }).results)
      ? (media as { results: unknown[] }).results
      : [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as SpeciesMediaItem;
    if (!isStillImage(item)) continue;
    const author = typeof item.creator === 'string' ? item.creator.trim() : '';
    const license = parseFreeLicense(item.license);
    const src = httpsUrl(item.identifier ?? item.url);
    if (!author || !license || !src || !isAllowedRemoteImage(src)) continue;
    return { src, author, license, sourceUrl: httpsUrl(item.references) ?? src };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Groupes (filtres de la recherche)                                           */
/* -------------------------------------------------------------------------- */

/** Groupe proposé en filtre : classe GBIF envoyée à l'API (`class`), catégorie des profils Captivia. */
export interface SpeciesGroup {
  id: 'mammals' | 'birds' | 'reptiles' | 'amphibians' | 'fish' | 'insects' | 'arachnids';
  gbifClass: string;
  /** Catégorie des fiches Captivia (SpeciesProfile.category). */
  category: string;
  silhouette: SilhouetteKind;
}

export const SPECIES_GROUPS: readonly SpeciesGroup[] = [
  { id: 'mammals', gbifClass: 'Mammalia', category: 'mammifère', silhouette: 'mammal' },
  { id: 'birds', gbifClass: 'Aves', category: 'oiseau', silhouette: 'bird' },
  { id: 'reptiles', gbifClass: 'Reptilia', category: 'reptile', silhouette: 'reptile' },
  { id: 'amphibians', gbifClass: 'Amphibia', category: 'amphibien', silhouette: 'amphibian' },
  { id: 'fish', gbifClass: 'Actinopterygii', category: 'poisson', silhouette: 'fish' },
  { id: 'insects', gbifClass: 'Insecta', category: 'insecte', silhouette: 'invertebrate' },
  { id: 'arachnids', gbifClass: 'Arachnida', category: 'arachnide', silhouette: 'invertebrate' },
];

export function speciesGroupById(id: string | null | undefined): SpeciesGroup | null {
  return SPECIES_GROUPS.find((g) => g.id === id) ?? null;
}

/** Groupe d'une espèce d'après sa classe GBIF ou sa catégorie Captivia. */
export function speciesGroupOf(value: { class?: string | null; category?: string | null }): SpeciesGroup | null {
  const cls = value.class?.trim().toLowerCase();
  const category = value.category?.trim().toLowerCase();
  return (
    SPECIES_GROUPS.find((g) => (cls && g.gbifClass.toLowerCase() === cls) || (category && g.category === category)) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* Résultats de recherche et noms                                              */
/* -------------------------------------------------------------------------- */

/** Résultat de GET /species/search, normalisé (profils Captivia ou repli GBIF). */
export interface SpeciesSummary {
  id: number;
  /** Nom vernaculaire français, s'il existe. */
  commonNameFr?: string;
  /** Binôme latin, sans l'autorité. */
  latin: string;
  group: SpeciesGroup | null;
  iucn: IucnCategory | null;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Deux formes coexistent : les profils Captivia (`vernacularName`, `category`, `scientificName`
 * = binôme, `canonicalName` = nom français) et le repli GBIF (`vernacularNames[]`, `class`,
 * `canonicalName` = binôme, `scientificName` avec l'autorité).
 */
export function normalizeSpeciesResult(raw: unknown): SpeciesSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.key !== 'number' || !str(r.scientificName)) return null;
  const isProfile = 'category' in r || 'vernacularName' in r;
  const vernacular = Array.isArray(r.vernacularNames) ? str(r.vernacularNames[0]) : undefined;
  const latin = isProfile ? str(r.scientificName)! : (str(r.canonicalName) ?? str(r.scientificName)!);
  const commonNameFr = isProfile ? str(r.vernacularName) : vernacular;
  return {
    id: r.key,
    commonNameFr: commonNameFr && commonNameFr !== latin ? commonNameFr : undefined,
    latin,
    group: speciesGroupOf({ class: str(r.class), category: str(r.category) }),
    iucn: iucnCategoryOf(str(r.iucnStatus)),
  };
}

/** Code UICN d'une valeur d'API (« LC », « Least Concern », « LEAST_CONCERN »). */
export function iucnCategoryOf(value: string | null | undefined): IucnCategory | null {
  return value ? toIucnCategory(value.replace(/_/g, ' ')) : null;
}

/**
 * Nom affiché en titre : les noms vernaculaires de l'API sont en français ; dans les autres
 * langues, la fiche est titrée par son binôme latin (même règle que les métadonnées SEO).
 */
export function speciesDisplayName(locale: string, commonNameFr: string | undefined, latin: string): { name: string; isLatin: boolean } {
  return locale === 'fr' && commonNameFr ? { name: commonNameFr, isLatin: false } : { name: latin, isLatin: true };
}

/** Sépare l'autorité taxonomique du nom scientifique : « Boa constrictor Linnaeus, 1758 » → « Linnaeus, 1758 ». */
export function authorityOf(scientificName: string | null | undefined, latin: string): string | undefined {
  const full = scientificName?.trim();
  if (!full || !full.startsWith(latin)) return undefined;
  const rest = full.slice(latin.length).trim();
  return rest || undefined;
}

/** Les speciesId ≥ 2 000 000 001 sont des races (identifiants Captivia), absentes de GBIF. */
export function isGbifKey(id: number | null | undefined): boolean {
  return typeof id === 'number' && Number.isInteger(id) && id > 0 && id < 2_000_000_001;
}

/** Rangs taxonomiques traduits (`species.rank.*`) ; un rang inconnu n'est pas affiché brut. */
export const KNOWN_RANKS = ['KINGDOM', 'PHYLUM', 'CLASS', 'ORDER', 'FAMILY', 'GENUS', 'SPECIES', 'SUBSPECIES', 'VARIETY', 'BREED'] as const;
export type SpeciesRank = (typeof KNOWN_RANKS)[number];

export function speciesRankOf(rank: string | null | undefined, id: number): SpeciesRank | null {
  if (!isGbifKey(id)) return 'BREED';
  const value = rank?.trim().toUpperCase();
  return (KNOWN_RANKS as readonly string[]).includes(value ?? '') ? (value as SpeciesRank) : null;
}
