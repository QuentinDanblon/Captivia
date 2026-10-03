'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import AnimalSilhouette, { type SilhouetteKind } from './AnimalSilhouette';
import ExternalLink from './ExternalLink';
import { cx } from './cx';

/** Crédit obligatoire de toute photo (cf. public/images/CREDITS.md et DESIGN.md § 7). */
export interface PhotoCredit {
  /** Auteur tel que demandé par la licence (« Jane Doe », « USFWS »). */
  author: string;
  /** Licence libre vérifiée : « CC0 1.0 », « CC BY 4.0 », « CC BY-SA 4.0 », « Domaine public ». */
  license: string;
  /** Page source (fiche Wikimedia Commons…). */
  sourceUrl: string;
  /** Texte de la licence (lien « CC BY-SA 4.0 »). */
  licenseUrl?: string;
}

/** `fill` : le cadre prend la taille de son parent (fond de bandeau) au lieu d'un ratio fixe. */
export type FigureRatio = '1/1' | '4/3' | '3/2' | '16/9' | '3/4' | 'fill';

interface FigureBase {
  /** Ratio fixe : la place est réservée avant le chargement (pas de CLS). */
  ratio?: FigureRatio;
  /** `grain` (léger grain argentique) ou `duotone` (bichromie encre/papier), sinon photo telle quelle. */
  treatment?: 'none' | 'grain' | 'duotone';
  /** Silhouette affichée sans photo ou si le chargement échoue. */
  fallbackKind?: SilhouetteKind;
  /** Légende éditoriale (avant le crédit). */
  caption?: ReactNode;
  /** Attribut `sizes` (défaut : pleine largeur en mobile, 50 vw au-delà). */
  sizes?: string;
  /** Image au-dessus de la ligne de flottaison : chargement prioritaire au lieu de `lazy`. */
  priority?: boolean;
  /** Cadrage dans le ratio (`object-position`), ex. `70% 40%` pour garder une tête dans le cadre. */
  objectPosition?: string;
  /**
   * Où afficher le crédit : `caption` (défaut, sous la photo), `overlay` (cartouche discret posé
   * dans un coin de la photo, toujours lisible et cliquable — grandes photos de landing) ou
   * `external` (le composant englobant l'affiche lui-même, ex. la légende d'un aperçu d'écran).
   * Le crédit reste obligatoire dans tous les cas.
   */
  creditPlacement?: 'caption' | 'overlay' | 'external';
  /** Coin du cartouche `overlay` (défaut : en bas), pour ne pas passer sous un élément superposé. */
  creditCorner?: 'top' | 'bottom';
  className?: string;
}

/** Source alternative d'un `<picture>` (AVIF, puis repli WebP / JPEG dans `srcSet`). */
export interface FigureSource {
  type: string;
  srcSet: string;
}

/** Avec photo : `alt` et `credit` sont obligatoires (vérifié par le typage). */
interface FigureWithPhoto extends FigureBase {
  src: string;
  alt: string;
  credit: PhotoCredit;
  userPhoto?: false;
  /**
   * Variantes responsives (`srcset` de l'image, formats modernes dans `sources`) : la photo est
   * alors servie par un `<picture>` natif — l'optimiseur de next/image est désactivé dans ce projet
   * (export statique mobile), les variantes sont produites à l'avance.
   */
  srcSet?: string;
  sources?: FigureSource[];
}

/**
 * Photo prise par l'utilisateur (son animal) : pas de licence à citer, mais un `alt` obligatoire.
 * Seule exception au crédit obligatoire (DESIGN.md § 10.3).
 */
interface FigureUserPhoto extends FigureBase {
  src: string;
  alt: string;
  credit?: undefined;
  userPhoto: true;
  srcSet?: undefined;
  sources?: undefined;
}

/** Sans photo : silhouette au trait, pas de crédit. */
interface FigureWithoutPhoto extends FigureBase {
  src?: undefined;
  alt?: string;
  credit?: undefined;
  userPhoto?: undefined;
  srcSet?: undefined;
  sources?: undefined;
}

export type FigureProps = FigureWithPhoto | FigureUserPhoto | FigureWithoutPhoto;

const RATIO_CLASS: Record<FigureRatio, string> = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '3/2': 'aspect-[3/2]',
  '16/9': 'aspect-video',
  '3/4': 'aspect-[3/4]',
  fill: 'size-full',
};

/**
 * Photographie d'animal ou de milieu : ratio fixe, chargement différé, coins 6 px, traitement
 * optionnel (grain / bichromie) et légende avec crédit + licence. Sans photo (ou en cas
 * d'erreur), une silhouette au trait occupe le même cadre — jamais de dégradé + initiale.
 *
 * @example
 * <Figure
 *   src="/images/species/boa-constrictor.jpg"
 *   alt="Boa constricteur enroulé sur une branche"
 *   ratio="4/3"
 *   credit={{ author: 'Jane Doe', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:…', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' }}
 * />
 */
function CreditLine({ credit }: { credit: PhotoCredit }) {
  return (
    <>
      ©{' '}
      <ExternalLink href={credit.sourceUrl} className="underline decoration-1 underline-offset-2">
        {credit.author}
      </ExternalLink>
      {' · '}
      {credit.licenseUrl ? (
        <ExternalLink href={credit.licenseUrl} rel="license" className="underline decoration-1 underline-offset-2">
          {credit.license}
        </ExternalLink>
      ) : (
        credit.license
      )}
    </>
  );
}

export default function Figure(props: FigureProps) {
  const {
    ratio = '4/3',
    treatment = 'none',
    fallbackKind = 'other',
    caption,
    sizes,
    priority = false,
    objectPosition,
    creditPlacement = 'caption',
    creditCorner = 'bottom',
    className,
  } = props;
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(props.src) && !failed;
  const credit = props.src ? props.credit : undefined;
  const responsive = Boolean(props.srcSet || props.sources?.length);
  const resolvedSizes = sizes ?? '(min-width: 768px) 50vw, 100vw';
  const overlayCredit = creditPlacement === 'overlay' && credit && showPhoto;
  const captionCredit = creditPlacement === 'caption' && credit && showPhoto;

  return (
    <figure className={cx('m-0 grid gap-2', className)}>
      <div className={cx('cv-photo', RATIO_CLASS[ratio])} data-treatment={showPhoto ? treatment : 'none'}>
        {showPhoto && props.src && responsive ? (
          <picture>
            {props.sources?.map((source) => (
              <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={resolvedSizes} />
            ))}
            <img
              src={props.src}
              srcSet={props.srcSet}
              sizes={resolvedSizes}
              alt={props.alt}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : undefined}
              onError={() => setFailed(true)}
              className="absolute inset-0 size-full"
              style={objectPosition ? { objectPosition } : undefined}
            />
          </picture>
        ) : showPhoto && props.src ? (
          <Image
            src={props.src}
            alt={props.alt}
            fill
            sizes={sizes ?? '(min-width: 768px) 50vw, 100vw'}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            onError={() => setFailed(true)}
            style={objectPosition ? { objectPosition } : undefined}
          />
        ) : (
          <div className="cv-photo__fallback">
            <AnimalSilhouette kind={fallbackKind} size={72} title={props.alt || undefined} />
          </div>
        )}
        {overlayCredit ? (
          <p className="cv-photo__credit m-0 font-mono text-meta" data-corner={creditCorner}>
            <CreditLine credit={credit} />
          </p>
        ) : null}
      </div>
      {caption || captionCredit ? (
        <figcaption className="grid gap-0.5 text-meta text-ink-2">
          {caption ? <span className="text-ui text-ink">{caption}</span> : null}
          {captionCredit ? (
            <span className="font-mono">
              <CreditLine credit={credit} />
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export { Figure };
