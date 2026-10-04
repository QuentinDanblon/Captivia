'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { PHOTOS } from '@/content/photos';
import { CATEGORY_TEXTURES } from '@/content/category-textures';
import { ExternalLink } from '@/components/ui';

/** Real photographs reflected at each tile edge, rather than an illustrated skin pattern. */
export function CategoryBackdrop({ selectedId }: { selectedId: string | null }) {
  const prefix = useId().replace(/:/g, '');
  return <div className="species-explorer__backdrop" aria-hidden="true">
    {Object.entries(CATEGORY_TEXTURES).map(([groupId, photoKey]) => {
      const photo = PHOTOS[photoKey];
      const patternId = `${prefix}-${groupId}`;
      const src = `${photo.base}-${photo.widths[0]}.webp`;
      return <svg key={groupId} className="species-explorer__texture" data-active={groupId === selectedId} data-texture-layer={groupId}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="384" height="384">
            <image href={src} width="192" height="192" preserveAspectRatio="xMidYMid slice" />
            <image href={src} width="192" height="192" preserveAspectRatio="xMidYMid slice" transform="translate(384 0) scale(-1 1)" />
            <image href={src} width="192" height="192" preserveAspectRatio="xMidYMid slice" transform="translate(0 384) scale(1 -1)" />
            <image href={src} width="192" height="192" preserveAspectRatio="xMidYMid slice" transform="translate(384 384) scale(-1 -1)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>;
    })}
  </div>;
}

export function CategoryTextureCredit({ selectedId }: { selectedId: string | null }) {
  const t = useTranslations('speciesSearch');
  const key = selectedId ? CATEGORY_TEXTURES[selectedId] : undefined;
  if (!key) return null;
  const { credit } = PHOTOS[key];
  return <p className="species-explorer__texture-credit">
    {t('textureCredit')}{' '}
    <ExternalLink href={credit.sourceUrl} rel="license">{credit.author}</ExternalLink>{' · '}
    {credit.licenseUrl ? <ExternalLink href={credit.licenseUrl} rel="license">{credit.license}</ExternalLink> : credit.license}
  </p>;
}
