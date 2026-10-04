'use client';

import { useTranslations } from 'next-intl';
import { useRef, type PointerEvent } from 'react';
import { Check } from 'lucide-react';
import { PHOTOS, photoSources, type PhotoKey } from '@/content/photos';
import { SPECIES_GROUPS, type SpeciesGroup } from '@/lib/species';
import { IS_MOBILE_BUILD } from '@/lib/platform';
import './category-cards.css';

export interface CategoryCardsProps {
  groups?: readonly SpeciesGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const GROUP_PHOTOS: Record<SpeciesGroup['id'], PhotoKey> = {
  mammals: 'categoryMammals',
  birds: 'categoryBirds',
  reptiles: 'categoryReptiles',
  amphibians: 'categoryAmphibians',
  fish: 'categoryFish',
  insects: 'categoryInsects',
  arachnids: 'emperorScorpion',
};

const DEFAULT_GROUP_ORDER: readonly SpeciesGroup['id'][] = [
  'mammals', 'birds', 'fish', 'reptiles', 'amphibians', 'insects',
];

function CategoryCard({
  group,
  selected,
  onSelect,
}: {
  group: SpeciesGroup;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('speciesSearch');
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const photoKey = GROUP_PHOTOS[group.id];
  const photo = photoSources(photoKey);
  const credit = PHOTOS[photoKey].credit;

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    suppressClick.current = false;
    if (event.pointerType === 'mouse') return;
    start.current = { x: event.clientX, y: event.clientY };
    moved.current = false;
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return;
    if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) {
      moved.current = true;
    }
  };
  const onPointerUp = () => {
    if (moved.current) {
      suppressClick.current = true;
    }
    start.current = null;
  };

  const groupLabel = t(`groups.${group.id}`);
  return (
    <article className="species-category-item">
      <button
        type="button"
        className="species-category-card"
        data-category={group.id}
        aria-label={groupLabel}
        aria-pressed={selected}
        onClick={(event) => {
          if (event.detail !== 0 && suppressClick.current) {
            event.preventDefault();
            suppressClick.current = false;
            return;
          }
          onSelect(group.id);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { suppressClick.current = true; start.current = null; }}
      >
        <picture className="species-category-card__picture">
          {photo.sources?.map((source) => (
            <source key={source.type} type={source.type} srcSet={source.srcSet} />
          ))}
          <img src={photo.src} srcSet={photo.srcSet} sizes="(max-width: 520px) calc(100vw - 32px), 544px" alt="" draggable={false} decoding="async" loading={group.id === 'mammals' ? 'eager' : 'lazy'} />
        </picture>
        <span className="species-category-card__scrim" aria-hidden="true" />
        {selected ? <span className="species-category-card__selected" aria-hidden="true"><Check size={22} strokeWidth={2} /></span> : null}
        <span className="species-category-card__content">
          <span className="species-category-card__name">{groupLabel}</span>
        </span>
      </button>
      <p className="species-category-card__credit">
        © <a href={credit.sourceUrl} target="_blank" rel="noreferrer">{credit.author}</a>
        {credit.licenseUrl ? (
          <> · <a href={credit.licenseUrl} target="_blank" rel="license noreferrer">{credit.license}</a></>
        ) : <> · {credit.license}</>}
      </p>
    </article>
  );
}

export function CategoryCards({ groups = SPECIES_GROUPS, selectedId, onSelect }: CategoryCardsProps) {
  const t = useTranslations('speciesSearch');
  const visibleGroups = groups
    .filter((group) => DEFAULT_GROUP_ORDER.includes(group.id))
    .sort((left, right) => DEFAULT_GROUP_ORDER.indexOf(left.id) - DEFAULT_GROUP_ORDER.indexOf(right.id));
  return (
    <div
      className={`species-category-cards${IS_MOBILE_BUILD ? ' species-category-cards--vertical' : ''}`}
      role="group"
      aria-label={t('groupsLabel')}
      tabIndex={IS_MOBILE_BUILD ? undefined : 0}
    >
      {visibleGroups.map((group) => (
        <CategoryCard
          key={group.id}
          group={group}
          selected={selectedId === group.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default CategoryCards;
