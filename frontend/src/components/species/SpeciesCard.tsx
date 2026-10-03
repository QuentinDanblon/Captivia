'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IucnBadge } from '@/components/ui';
import { speciesPath } from '@/lib/platform';
import { speciesDisplayName, type SpeciesSummary } from '@/lib/species';
import { SpeciesPhotoFigure } from './SpeciesPhotoFigure';
import { useSpeciesPhoto } from './useSpeciesPhoto';

/** Vrai dès que l'élément approche du viewport (la vignette n'est demandée qu'à ce moment). */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  // Sans IntersectionObserver (très vieux navigateurs, tests), la vignette est demandée d'emblée.
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near] as const;
}

/**
 * Carte d'un résultat de recherche : vignette (photo créditée ou silhouette), nom, binôme latin,
 * groupe et statut UICN. Toute la carte mène à la fiche (lien étiré) ; les liens du crédit
 * photo restent cliquables au-dessus.
 */
export function SpeciesCard({ species }: { species: SpeciesSummary }) {
  const t = useTranslations();
  const locale = useLocale();
  const [ref, near] = useNearViewport<HTMLLIElement>();
  const photo = useSpeciesPhoto(species.id, near);
  const { name, isLatin } = speciesDisplayName(locale, species.commonNameFr, species.latin);
  const groupLabel = species.group ? t(`home.taxonomy.${species.group.gbifClass}`) : null;
  const ready = photo.status === 'ready' ? photo.photo : null;

  return (
    <li
      ref={ref}
      data-testid="species-card"
      className="relative grid grid-cols-[5.5rem_minmax(0,1fr)] content-start gap-4 rounded-card border border-line bg-surface p-3 text-ink transition-colors focus-within:border-line-field hover:border-line-field sm:grid-cols-1 sm:gap-3 sm:p-3"
    >
      <SpeciesPhotoFigure
        state={photo}
        alt={t('speciesSearch.photoAlt', { name })}
        fallbackKind={species.group?.silhouette ?? 'other'}
        ratio="fill"
        sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 6rem"
        creditPlacement="external"
        className="size-22 sm:aspect-[3/2] sm:h-auto sm:w-full"
      />
      <div className="grid min-w-0 content-start gap-1 sm:px-1 sm:pb-1">
        <h3 className="m-0 text-h4 leading-snug">
          <Link
            href={speciesPath(species.id)}
            className="text-ink no-underline after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {isLatin ? (
              <i lang="la" className="latin">
                {name}
              </i>
            ) : (
              name
            )}
          </Link>
        </h3>
        {!isLatin ? (
          <p className="m-0 truncate text-ui text-ink-2">
            <i lang="la" className="latin">
              {species.latin}
            </i>
          </p>
        ) : null}
        {groupLabel || species.iucn ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {groupLabel ? <span className="text-meta text-ink-2">{groupLabel}</span> : null}
            {species.iucn ? <IucnBadge category={species.iucn} label={t(`species.iucn.${species.iucn}`)} showLabel={false} /> : null}
          </div>
        ) : null}
        {ready ? (
          <p className="relative z-10 m-0 mt-1 font-mono text-meta break-words text-ink-2">
            {t('speciesSearch.photoBy')}{' '}
            <a href={ready.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline decoration-1 underline-offset-2">
              {ready.author}
            </a>
            {' · '}
            <a href={ready.license.url} target="_blank" rel="noopener noreferrer license" className="text-ink-2 underline decoration-1 underline-offset-2">
              {ready.license.label}
            </a>
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default SpeciesCard;
