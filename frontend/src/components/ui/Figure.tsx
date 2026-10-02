'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import AnimalSilhouette, { type SilhouetteKind } from './AnimalSilhouette';
import { cx } from './cx';

/** Crédit obligatoire de toute photo (cf. public/images/CREDITS.md et DESIGN.md § Imagerie). */
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

export type FigureRatio = '1/1' | '4/3' | '3/2' | '16/9' | '3/4';

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
  className?: string;
}

/** Avec photo : `alt` et `credit` sont obligatoires (vérifié par le typage). */
interface FigureWithPhoto extends FigureBase {
  src: string;
  alt: string;
  credit: PhotoCredit;
}

/** Sans photo : silhouette au trait, pas de crédit. */
interface FigureWithoutPhoto extends FigureBase {
  src?: undefined;
  alt?: string;
  credit?: undefined;
}

export type FigureProps = FigureWithPhoto | FigureWithoutPhoto;

const RATIO_CLASS: Record<FigureRatio, string> = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '3/2': 'aspect-[3/2]',
  '16/9': 'aspect-video',
  '3/4': 'aspect-[3/4]',
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
export default function Figure(props: FigureProps) {
  const { ratio = '4/3', treatment = 'none', fallbackKind = 'other', caption, sizes, priority = false, className } = props;
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(props.src) && !failed;
  const credit = props.src ? props.credit : undefined;

  return (
    <figure className={cx('m-0 grid gap-2', className)}>
      <div className={cx('cv-photo', RATIO_CLASS[ratio])} data-treatment={showPhoto ? treatment : 'none'}>
        {showPhoto && props.src ? (
          <Image
            src={props.src}
            alt={props.alt}
            fill
            sizes={sizes ?? '(min-width: 768px) 50vw, 100vw'}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="cv-photo__fallback">
            <AnimalSilhouette kind={fallbackKind} size={72} title={props.alt || undefined} />
          </div>
        )}
      </div>
      {caption || (credit && showPhoto) ? (
        <figcaption className="grid gap-0.5 text-meta text-ink-2">
          {caption ? <span className="text-ui text-ink">{caption}</span> : null}
          {credit && showPhoto ? (
            <span className="font-mono">
              ©{' '}
              <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2">
                {credit.author}
              </a>
              {' · '}
              {credit.licenseUrl ? (
                <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline decoration-1 underline-offset-2">
                  {credit.license}
                </a>
              ) : (
                credit.license
              )}
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export { Figure };
