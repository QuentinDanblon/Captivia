'use client';

import { use, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import {
  authorityOf,
  iucnCategoryOf,
  isGbifKey,
  speciesDisplayName,
  speciesGroupOf,
  speciesRankOf,
} from '@/lib/species';
import {
  AnimalSilhouette,
  Button,
  EmptyState,
  IucnBadge,
  IucnScale,
  IUCN_CATEGORIES,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  buttonClasses,
  cx,
  type IucnCategory,
} from '@/components/ui';
import { SpeciesPhotoFigure } from '@/components/species/SpeciesPhotoFigure';
import { useSpeciesPhoto } from '@/components/species/useSpeciesPhoto';
import {
  BehaviorSection,
  EquipmentSection,
  FeedingSection,
  HabitatSection,
  HealthSection,
  LegislationSection,
  ReproductionSection,
  SourcesSection,
  hasBehavior,
  hasFeeding,
  hasHabitat,
  hasReproduction,
} from './_components/sections';
import { SheetAnchors, SheetToc, type TocEntry } from './_components/SheetToc';
import type {
  EquipmentData,
  HealthData,
  LegislationData,
  ReproductionData,
  SourceRef,
  SpeciesData,
  SpeciesSheet,
} from './_components/types';

type LoadState =
  | { key: string; status: 'ready'; sheet: SpeciesSheet }
  | { key: string; status: 'not_found' }
  | { key: string; status: 'error' };

async function loadSheet(id: string, locale: string): Promise<SpeciesSheet> {
  // La fiche est indispensable ; les sous-ressources sont facultatives (section vide si absentes).
  const optional = <T,>(p: Promise<unknown>) => p.then((v) => (v ?? null) as T | null).catch(() => null);
  const [species, health, legislation, equipment, reproduction] = await Promise.all([
    api.getSpecies(id) as Promise<SpeciesData>,
    optional<HealthData>(api.getSpeciesHealth(id, undefined, locale)),
    optional<LegislationData>(api.getSpeciesLegislation(id)),
    optional<EquipmentData>(api.getRecommendedEquipment(Number(id))),
    optional<ReproductionData>(api.getSpeciesReproduction(id)),
  ]);
  return { species, health, legislation, equipment, reproduction };
}

/** Colonnes du bandeau de repères au-delà de 640 px, selon le nombre de cellules. */
const SM_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

const isNotFound = (err: unknown) =>
  (err instanceof ApiError && err.status === 404) || (err instanceof Error && /not found/i.test(err.message));

function SheetSkeleton({ label }: { label: string }) {
  return (
    <div className="cv-container py-6 sm:py-8">
      <SkeletonGroup label={label} className="grid gap-8">
        <Skeleton width="10rem" />
        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <Skeleton shape="block" className="aspect-[4/3]" />
          <div className="grid content-start gap-4">
            <Skeleton width="55%" height={36} />
            <Skeleton width="35%" height={22} />
            <Skeleton height={5} />
            <SkeletonText lines={2} />
            <Skeleton shape="block" height={72} />
          </div>
        </div>
        <Skeleton shape="block" height={220} />
        <Skeleton shape="block" height={180} />
      </SkeletonGroup>
    </div>
  );
}

/**
 * Fiche espèce (consultable sans compte, sous la coquille de l'app) : en-tête « planche
 * naturaliste » (photo créditée ou silhouette, nom, binôme latin, n° GBIF, statut UICN), puis
 * les repères pratiques en sections ancrées, sommaire collant en bureau.
 */
export default function SpeciesDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  const requestKey = `${id}:${locale}:${attempt}`;
  const photo = useSpeciesPhoto(id);

  useEffect(() => {
    let cancelled = false;
    loadSheet(id, locale)
      .then((sheet) => {
        if (!cancelled) setState({ key: requestKey, status: 'ready', sheet });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (!isNotFound(err)) console.error('Fiche espèce indisponible :', err);
        setState({ key: requestKey, status: isNotFound(err) ? 'not_found' : 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale, requestKey]);

  if (!state || state.key !== requestKey) return <SheetSkeleton label={t('species.loading')} />;

  if (state.status !== 'ready') {
    const notFound = state.status === 'not_found';
    return (
      <div className="cv-container py-6 sm:py-8">
        <EmptyState
          size="page"
          headingLevel={1}
          title={notFound ? t('species.notFoundTitle') : t('species.errorTitle')}
          benefit={notFound ? t('species.notFoundBenefit') : t('species.errorBenefit')}
          illustration={<AnimalSilhouette kind="other" size={64} />}
          action={
            notFound ? (
              <Link href="/especes" className={buttonClasses()}>
                {t('species.searchAnother')}
              </Link>
            ) : (
              <Button onClick={() => setAttempt((n) => n + 1)}>{t('common.retry')}</Button>
            )
          }
        />
      </div>
    );
  }

  const { species, health, legislation, equipment, reproduction } = state.sheet;
  const speciesId = Number(species.profile?.speciesId ?? species.key ?? id);
  const latin = species.profile?.scientificName || species.canonicalName || species.scientificName;
  const authority = authorityOf(species.scientificName, latin);
  const { name, isLatin } = speciesDisplayName(locale, species.profile?.commonNameFr, latin);
  const group = speciesGroupOf({ class: species.class, category: species.profile?.category });
  const groupLabel = group ? t(`home.taxonomy.${group.gbifClass}`) : null;
  const rank = speciesRankOf(species.rank, speciesId);
  const iucn = iucnCategoryOf(species.iucnStatus);
  const iucnLabels = Object.fromEntries(IUCN_CATEGORIES.map((c) => [c, t(`species.iucn.${c}`)])) as Record<IucnCategory, string>;
  const distribution = Array.isArray(species.distribution) ? species.distribution.join(', ') : species.distribution?.trim() || null;
  const classification = [species.kingdom, species.phylum, species.class, species.order, species.family, species.genus].filter(Boolean);
  const readyPhoto = photo.status === 'ready' ? photo.photo : null;
  const addHref = `/mes-animaux?addSpecies=${encodeURIComponent(String(speciesId))}&speciesName=${encodeURIComponent(latin)}`;

  const showFeeding = hasFeeding(species.feeding);
  const showHabitat = hasHabitat(species.habitat, distribution);
  const showBehavior = hasBehavior(species.behavior);
  const showReproduction = hasReproduction(reproduction);
  const showEquipment = (equipment?.recommendations?.length ?? 0) > 0;

  const toc: TocEntry[] = [
    showFeeding && { id: 'alimentation', label: t('species.sections.feeding') },
    showHabitat && { id: 'habitat', label: t('species.sections.habitat') },
    showBehavior && { id: 'comportement', label: t('species.sections.behavior') },
    { id: 'sante', label: t('species.sections.health') },
    showReproduction && { id: 'reproduction', label: t('species.sections.reproduction') },
    { id: 'legislation', label: t('species.sections.legislation') },
    showEquipment && { id: 'materiel', label: t('species.sections.equipment') },
    { id: 'sources', label: t('species.sections.sources') },
  ].filter((e): e is TocEntry => Boolean(e));

  const sectionSources: Array<SourceRef | string> = [
    ...(species.feeding?.sources ?? []),
    ...(species.habitat?.sources ?? []),
    ...(species.behavior?.sources ?? []),
    ...(health?.editorial?.sources ?? []),
    ...(reproduction?.sources ?? []),
    ...(legislation?.editorial ?? []).flatMap((item) => item.sources ?? []),
  ];

  type FactCell = { key: string; label: string; value: ReactNode };
  const cells = ([
    rank && { key: 'rank', label: t('species.facts.rank'), value: t(`species.rank.${rank}`) },
    groupLabel && { key: 'group', label: t('species.facts.group'), value: groupLabel },
    species.family && { key: 'family', label: t('species.facts.family'), value: species.family },
    iucn && { key: 'iucn', label: t('species.facts.iucn'), value: <IucnBadge category={iucn} label={iucnLabels[iucn]} /> },
  ] as Array<FactCell | null | false | ''>).filter((f): f is FactCell => Boolean(f));

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <nav aria-label={t('species.breadcrumb')} className="text-ui text-ink-2">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/especes" className="text-ink-2 underline decoration-1 underline-offset-2 hover:text-ink">
              {t('nav.species')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {isLatin ? (
              <i lang="la" className="latin">
                {name}
              </i>
            ) : (
              name
            )}
          </li>
        </ol>
      </nav>

      {/* En-tête « planche naturaliste » : photo (ou silhouette), nom, binôme, n° GBIF, repères. */}
      <header className="grid gap-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <SpeciesPhotoFigure
          state={photo}
          alt={t('species.photoAlt', { name })}
          fallbackKind={group?.silhouette ?? 'other'}
          ratio="4/3"
          sizes="(min-width: 1024px) 20rem, (min-width: 768px) 17rem, 100vw"
        />

        <div className="grid min-w-0 gap-5">
          <SectionHeader
            title={
              isLatin ? (
                <i lang="la" className="latin">
                  {name}
                </i>
              ) : (
                name
              )
            }
            latin={isLatin ? undefined : latin}
            authority={isLatin ? undefined : authority}
            marginNote={isGbifKey(speciesId) ? `GBIF ${speciesId}` : undefined}
            marginLabel={t('species.gbifLabel')}
            description={species.profile?.description || undefined}
            actions={
              <Link href={addHref} className={buttonClasses()} data-testid="add-species-animal">
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                {t('species.addAnimal')}
              </Link>
            }
          />

          {cells.length > 0 ? (
            <section aria-labelledby="species-facts-title" className="overflow-hidden rounded-card border border-line">
              <h2 id="species-facts-title" className="sr-only">
                {t('species.facts.title')}
              </h2>
              {/* Filets d'une cellule à l'autre : la grille est posée sur le filet (gap-px). */}
              <dl className={cx('m-0 grid grid-cols-2 gap-px bg-line', SM_COLS[cells.length])}>
                {cells.map((cell, i) => (
                  <div
                    key={cell.key}
                    className={cx(
                      'grid content-start gap-1 bg-surface px-4 py-3',
                      cells.length % 2 === 1 && i === cells.length - 1 && 'col-span-2 sm:col-span-1',
                    )}
                  >
                    <dt className="text-meta text-ink-2">{cell.label}</dt>
                    <dd className="m-0 text-body font-medium break-words text-ink">{cell.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {classification.length > 1 ? (
            <p className="m-0 font-mono text-meta break-words text-ink-2">
              <span className="sr-only">{t('species.classification')} : </span>
              {classification.join(' › ')}
            </p>
          ) : null}
        </div>
      </header>

      <SheetAnchors entries={toc} label={t('species.tocLabel')} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_13rem] xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid min-w-0 content-start gap-6">
          {showFeeding && species.feeding ? <FeedingSection feeding={species.feeding} /> : null}
          {showHabitat ? <HabitatSection habitat={species.habitat ?? null} distribution={distribution} /> : null}
          {showBehavior && species.behavior ? <BehaviorSection behavior={species.behavior} /> : null}
          <HealthSection health={health} />
          {showReproduction && reproduction ? <ReproductionSection reproduction={reproduction} /> : null}
          <LegislationSection legislation={legislation} />
          {showEquipment && equipment ? <EquipmentSection equipment={equipment} /> : null}
          <SourcesSection species={species} speciesId={speciesId} sectionSources={sectionSources} photo={readyPhoto} />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 grid gap-8">
            <SheetToc entries={toc} label={t('species.tocLabel')} />
            {iucn ? (
              <div className="grid gap-2 border-t border-line pt-4">
                <p className="m-0 text-meta text-ink-2">{t('species.facts.iucn')}</p>
                <IucnScale category={iucn} labels={iucnLabels} aria-label={t('species.facts.iucn')} />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
