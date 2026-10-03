'use client';

import { useTranslations } from 'next-intl';
import { Figure, type FigureRatio } from '@/components/ui';
import { photoSources, type PhotoKey } from '@/content/photos';

export interface CommonsPhotoProps {
  /** Photo de la photothèque (`content/photos.ts`, inscrite dans `public/images/CREDITS.md`). */
  photo: PhotoKey;
  ratio?: Exclude<FigureRatio, 'fill'>;
  sizes?: string;
  className?: string;
}

/**
 * Photo Wikimedia Commons de la photothèque, prête à poser : `<picture>` AVIF/WebP, texte
 * alternatif traduit (`landing.photos.<clé>`), grain léger et crédit (auteur, licence, source) en
 * légende. Sert aux planches des écrans de compte et à l'essai sans compte.
 */
export function CommonsPhoto({ photo, ratio = '3/2', sizes = '(min-width: 1200px) 520px, (min-width: 768px) 45vw, 100vw', className }: CommonsPhotoProps) {
  const t = useTranslations('landing.photos');
  return <Figure {...photoSources(photo)} alt={t(photo)} ratio={ratio} treatment="grain" sizes={sizes} className={className} />;
}

export default CommonsPhoto;
