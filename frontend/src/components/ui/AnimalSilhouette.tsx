import type { SVGProps } from 'react';

/** Grandes classes animales illustrées. */
export type SilhouetteKind = 'reptile' | 'bird' | 'mammal' | 'amphibian' | 'fish' | 'invertebrate' | 'other';

/**
 * Convertit une classe taxonomique (GBIF : « Reptilia », « Aves »…) ou une catégorie de l'app
 * (« reptile », « oiseau »…) en silhouette. Inconnu → `other` (feuille).
 */
export function silhouetteKindOf(value: string | null | undefined): SilhouetteKind {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return 'other';
  if (/^(reptil|squamata|testudines|crocodylia|serpent|snake|lézard|lizard|tortue|turtle)/.test(v)) return 'reptile';
  if (/^(aves|bird|oiseau)/.test(v)) return 'bird';
  if (/^(mammal|mammif)/.test(v)) return 'mammal';
  if (/^(amphibi|anura|caudata|frog|grenouille)/.test(v)) return 'amphibian';
  if (/^(actinopterygii|chondrichthyes|sarcopterygii|fish|poisson|pisces)/.test(v)) return 'fish';
  if (/^(insect|arachnid|malacostraca|gastropoda|bivalvia|myriapoda|chilopoda|diplopoda|invert|araign|spider|crust)/.test(v))
    return 'invertebrate';
  return 'other';
}

export interface AnimalSilhouetteProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  kind: SilhouetteKind;
  /** Taille en px (carré). Défaut 48. */
  size?: number;
  /**
   * Texte alternatif. Absent → décoratif (`aria-hidden`). Présent → `role="img"` + `<title>`.
   * La vignette d'un animal sans photo est décorative : son nom est déjà écrit à côté.
   */
  title?: string;
}

/* Tracés 48 × 48, trait 1,5 px, extrémités arrondies : planche au trait, sans aplat. */
const PATHS: Record<SilhouetteKind, string[]> = {
  // Gecko vu de dessus : tête, corps fusiforme, quatre pattes à doigts, queue enroulée.
  reptile: [
    'M24 5.5c2.2 0 3.6 2 3.6 4.4 0 2.3-1.5 4.1-3.6 4.1s-3.6-1.8-3.6-4.1c0-2.4 1.4-4.4 3.6-4.4Z',
    'M24 14c-2.6 3.2-3 11.2 0 16.5 3-5.3 2.6-13.3 0-16.5Z',
    'M24 30.5c.2 5.4-2.8 9.6-7.6 9.9-3.6.2-5.4-2.6-3.6-4.6 1.4-1.5 3.8-.8 3.9 1',
    'M21.8 18.5 16 15.2m0 0-1.4-2.6m1.4 2.6-2.9-.2',
    'M26.2 18.5 32 15.2m0 0 1.4-2.6M32 15.2l2.9-.2',
    'M21.9 26.5 16.2 30m0 0-2.8-.4m2.8.4-.6 2.9',
    'M26.1 26.5 31.8 30m0 0 2.8-.4m-2.8.4.6 2.9',
  ],
  // Oiseau perché de profil : tête, bec, corps, aile, queue, pattes sur une branche.
  bird: [
    'M17.5 9.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
    'M12.7 13.4 7.5 15l5.3 1.4',
    'M14.6 19.2c-.4 7.4 5.4 12.4 13.6 11.6l12.3 3.2-5.2-6.4c-1.7-6.2-7.6-10.4-14.2-9.6',
    'M20.5 23.2c3.4 4 8 5.5 13.3 4.8',
    'M24.5 31.4V38m4-6.8V38',
    'M16 38h22',
  ],
  // Lapin assis de profil : longues oreilles, tête, corps, queue en pompon.
  mammal: [
    'M30.6 13.6c-1.8-4.6-1.4-8.6.9-9.6 2.3 1 2.8 5.2 1.4 9.6',
    'M32.5 12.6a5.6 5.6 0 1 1-4.2 10.2',
    'M29.4 22.5c-1.6-1.2-4.2-1.7-7-1.4-6.6.7-10.7 6-9.6 11.6.6 3.2 2.7 5.3 5.7 5.3H33c.8 0 1.4-.7 1.2-1.5-.6-2.5-2.3-4-4.4-4.5',
    'M12.6 30.4a2.2 2.2 0 1 1-1.1-4.1',
    'M23.5 38c.4-2.6 2.4-4.3 4.6-4.3',
  ],
  // Grenouille de face : yeux saillants, bouche, pattes repliées.
  amphibian: [
    'M12.5 29.5c0-7 5.1-11.8 11.5-11.8s11.5 4.8 11.5 11.8c0 4.6-4.9 7.2-11.5 7.2s-11.5-2.6-11.5-7.2Z',
    'M18 13.2a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2ZM30 13.2a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z',
    'M19.5 27c2.9 2.1 6.1 2.1 9 0',
    'M13 31.5c-4 1.6-5.4 5.7-2.3 7.2h6.8M35 31.5c4 1.6 5.4 5.7 2.3 7.2h-6.8',
    'M20 36.4v3.6m8-3.6v3.6',
  ],
  // Poisson de profil : corps en amande, nageoires, ouïe, queue fourchue.
  fish: [
    'M7.5 24c5.4-8.4 19-9.6 27.5 0-8.5 9.6-22.1 8.4-27.5 0Z',
    'M35 24l8.5-7.5c-1 5-1 10 0 15L35 24Z',
    'M17.5 18.3c1.8 3.6 1.8 7.8 0 11.4',
    'M21 16.3c2.4-3.4 6.3-4.3 9.3-2.1',
    'M22.5 31.4c1.4 2.2 3.6 2.9 5.6 2.1',
  ],
  // Insecte vu de dessus : tête, thorax, abdomen, six pattes coudées, antennes.
  invertebrate: [
    'M24 8.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z',
    'M24 14.2c2.1 0 3.5 1.6 3.5 3.6S26.1 21.4 24 21.4s-3.5-1.6-3.5-3.6 1.4-3.6 3.5-3.6Z',
    'M24 21.8c3.6 0 6.2 3.8 6.2 9s-2.6 9.4-6.2 9.4-6.2-4.2-6.2-9.4 2.6-9 6.2-9Z',
    'M20.8 16.2 15 12.8l-1.6-4M27.2 16.2l5.8-3.4 1.6-4',
    'M20.6 18.6 13.4 20l-3 3.2M27.4 18.6l7.2 1.4 3 3.2',
    'M21 20.8l-5.2 6.2-.8 5.6M27 20.8l5.2 6.2.8 5.6',
    'M23 8.6c-1.4-2.8-3.8-4.2-6.6-4.2M25 8.6c1.4-2.8 3.8-4.2 6.6-4.2',
  ],
  // Inconnu : feuille (la marque), sans connotation d'espèce.
  other: [
    'M10 38c-1-15.8 10-29 30-29.5.8 19.6-12.8 30.8-30 29.5Z',
    'M10 38 32 16',
    'M20.2 27.8h8.4M25.8 22.2v-7.4',
  ],
};

/** Petits aplats indispensables à la lecture (yeux). */
const DOTS: Partial<Record<SilhouetteKind, Array<[number, number, number]>>> = {
  bird: [[18.6, 13.6, 0.9]],
  mammal: [[33.6, 16.8, 0.9]],
  amphibian: [
    [18, 16.8, 1.1],
    [30, 16.8, 1.1],
  ],
  fish: [[12.8, 22.6, 1]],
};

/**
 * Silhouette au trait d'une classe animale — l'image par défaut d'un animal sans photo et
 * l'illustration des catégories. Hérite de `currentColor` (utiliser `text-ink-2` / `text-ink-3`).
 * Remplace les vignettes « dégradé + initiale ».
 *
 * @example <AnimalSilhouette kind={silhouetteKindOf(species.class)} size={64} className="text-ink-3" />
 */
export default function AnimalSilhouette({ kind, size = 48, title, strokeWidth = 1.5, ...props }: AnimalSilhouetteProps) {
  const labelled = title ? { role: 'img' as const } : { 'aria-hidden': true as const };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      data-kind={kind}
      {...labelled}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[kind].map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
      {(DOTS[kind] ?? []).map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

export { AnimalSilhouette };
