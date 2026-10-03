'use client';

import { Figure, Skeleton, type FigureProps, type FigureRatio, type SilhouetteKind } from '@/components/ui';
import type { SpeciesPhoto } from '@/lib/species';
import type { SpeciesPhotoState } from './useSpeciesPhoto';

export interface SpeciesPhotoFigureProps {
  state: SpeciesPhotoState;
  /** Texte alternatif de la photo (« Boa constricteur, photographie »). */
  alt: string;
  fallbackKind: SilhouetteKind;
  ratio?: FigureRatio;
  sizes?: string;
  creditPlacement?: FigureProps['creditPlacement'];
  className?: string;
}

export const photoCredit = (photo: SpeciesPhoto) => ({
  author: photo.author,
  license: photo.license.label,
  licenseUrl: photo.license.url,
  sourceUrl: photo.sourceUrl,
});

/**
 * Photo d'espèce : gabarit pendant le chargement, photo créditée (auteur + licence libre) si
 * l'API en fournit une, sinon la silhouette au trait de la classe. Jamais de photo sans crédit.
 */
export function SpeciesPhotoFigure({
  state,
  alt,
  fallbackKind,
  ratio = '4/3',
  sizes,
  creditPlacement = 'caption',
  className,
}: SpeciesPhotoFigureProps) {
  if (state.status === 'loading') {
    return (
      <div className={className}>
        <Skeleton shape="block" className={ratio === 'fill' ? 'size-full' : RATIO[ratio]} />
      </div>
    );
  }
  const { photo } = state;
  if (!photo) return <Figure ratio={ratio} fallbackKind={fallbackKind} className={className} />;
  return (
    <Figure
      src={photo.src}
      srcSet={photo.srcSet}
      sources={photo.sources}
      alt={alt}
      ratio={ratio}
      sizes={sizes}
      fallbackKind={fallbackKind}
      creditPlacement={creditPlacement}
      credit={photoCredit(photo)}
      className={className}
    />
  );
}

const RATIO: Record<Exclude<FigureRatio, 'fill'>, string> = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '3/2': 'aspect-[3/2]',
  '16/9': 'aspect-video',
  '3/4': 'aspect-[3/4]',
};

export default SpeciesPhotoFigure;
