'use client';

/**
 * Sections de la fiche espèce : alimentation, habitat, comportement, santé, reproduction,
 * réglementation, matériel et sources. Chacune est une carte ancrée (`SheetSection`), ses
 * valeurs chiffrées en mono, ses sources en note.
 */
import { useLocale, useTranslations } from 'next-intl';
import { countryName } from '@/lib/country';
import { isGbifKey, type SpeciesPhoto } from '@/lib/species';
import { Alert, Badge } from '@/components/ui';
import { FactList, InkList, SheetSection, SourceNote, formatRange, hostOf, safeUrl, valueLabel } from './parts';
import type {
  EquipmentData,
  FoodEntry,
  HealthData,
  LegislationData,
  ReproductionData,
  SourceRef,
  SpeciesBehavior,
  SpeciesData,
  SpeciesFeeding,
  SpeciesHabitat,
} from './types';

/** Mention « à confirmer » : contenu issu de l'enrichissement, pas encore relu. */
function ToConfirm() {
  const t = useTranslations();
  return (
    <Badge tone="warn" dot title={t('species.review.hint')}>
      {t('species.review.badge')}
    </Badge>
  );
}

const foodLines = (value: FoodEntry[] | string | null | undefined, kind: 'eat' | 'avoid'): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return value
    .map((f) =>
      kind === 'avoid'
        ? [f.name, f.reason].filter(Boolean).join(' : ')
        : [f.name, f.frequency, f.notes].filter(Boolean).join(' · '),
    )
    .filter(Boolean);
};

/* ----------------------------------------------------------------------------------------- */

export function hasFeeding(f: SpeciesFeeding | null | undefined): f is SpeciesFeeding {
  return Boolean(
    f && (f.dietType || f.mealFrequency || f.feedingFrequency || f.specificNeeds || foodLines(f.recommendedFoods, 'eat').length || foodLines(f.foodsToAvoid ?? f.avoidedFoods, 'avoid').length),
  );
}

export function FeedingSection({ feeding }: { feeding: SpeciesFeeding }) {
  const t = useTranslations();
  const eat = foodLines(feeding.recommendedFoods, 'eat');
  const avoid = foodLines(feeding.foodsToAvoid ?? feeding.avoidedFoods, 'avoid');
  return (
    <SheetSection id="alimentation" title={t('species.sections.feeding')}>
      <FactList
        items={[
          feeding.dietType && { label: t('species.dietType'), value: valueLabel(t, 'diet', feeding.dietType) },
          (feeding.mealFrequency || feeding.feedingFrequency) && {
            label: t('species.mealFrequency'),
            value: valueLabel(t, 'frequency', feeding.mealFrequency || feeding.feedingFrequency),
          },
        ]}
      />
      {eat.length > 0 || avoid.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {eat.length > 0 ? (
            <div className="grid content-start gap-2">
              <h3 className="m-0 font-sans text-ui font-semibold text-ink">{t('species.recommendedFoods')}</h3>
              <InkList items={eat} />
            </div>
          ) : null}
          {avoid.length > 0 ? (
            <div className="grid content-start gap-2">
              <h3 className="m-0 font-sans text-ui font-semibold text-ink">{t('species.foodsToAvoid')}</h3>
              <InkList items={avoid} marker="cross" />
            </div>
          ) : null}
        </div>
      ) : null}
      {feeding.specificNeeds ? (
        <div className="grid gap-1">
          <h3 className="m-0 font-sans text-ui font-semibold text-ink">{t('species.specificNeeds')}</h3>
          <p className="m-0 max-w-prose text-body text-ink">{feeding.specificNeeds}</p>
        </div>
      ) : null}
      <SourceNote sources={feeding.sources} />
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

export function hasHabitat(h: SpeciesHabitat | null | undefined, distribution: string | null): boolean {
  return Boolean(
    distribution ||
      (h &&
        (h.habitatType || h.tempMin != null || h.tempMax != null || h.humidityMin != null || h.humidityMax != null || h.minSpaceSize || h.spaceRequirements || h.lightNeeds || h.lighting || h.activityEnrichment || h.enrichment)),
  );
}

export function HabitatSection({ habitat, distribution }: { habitat: SpeciesHabitat | null; distribution: string | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const h = habitat ?? {};
  const temperature = formatRange(locale, h.tempMin, h.tempMax, '°C');
  const humidity = formatRange(locale, h.humidityMin, h.humidityMax, '%');
  return (
    <SheetSection id="habitat" title={t('species.sections.habitat')}>
      <FactList
        items={[
          h.habitatType && { label: t('species.habitatType'), value: valueLabel(t, 'habitat', h.habitatType) },
          temperature && { label: t('species.temperature'), value: temperature, mono: true },
          humidity && { label: t('species.humidity'), value: humidity, mono: true },
          (h.minSpaceSize || h.spaceRequirements) && { label: t('species.spaceRequirements'), value: h.minSpaceSize || h.spaceRequirements, mono: true },
          (h.lightNeeds || h.lighting) && { label: t('species.lighting'), value: h.lightNeeds || h.lighting, wide: true },
          (h.activityEnrichment || h.enrichment) && { label: t('species.enrichment'), value: h.activityEnrichment || h.enrichment, wide: true },
          h.hygieneNotes && { label: t('species.hygiene'), value: h.hygieneNotes, wide: true },
          h.costEstimate && { label: t('species.cost'), value: valueLabel(t, 'cost', h.costEstimate) },
          distribution && { label: t('species.distribution'), value: distribution, wide: true },
        ]}
      />
      <SourceNote sources={h.sources} />
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

export function hasBehavior(b: SpeciesBehavior | null | undefined): b is SpeciesBehavior {
  return Boolean(b && (b.generalBehavior || b.sociability || b.difficultyLevel || b.difficulty || b.compatibilityWithChildren || b.compatibilityWithOtherAnimals || b.compatibility));
}

export function BehaviorSection({ behavior }: { behavior: SpeciesBehavior }) {
  const t = useTranslations();
  return (
    <SheetSection id="comportement" title={t('species.sections.behavior')}>
      {behavior.generalBehavior ? <p className="m-0 max-w-prose text-body text-ink">{behavior.generalBehavior}</p> : null}
      <FactList
        items={[
          behavior.sociability && { label: t('species.sociability'), value: valueLabel(t, 'sociability', behavior.sociability) },
          (behavior.difficultyLevel || behavior.difficulty) && {
            label: t('species.difficultyLevel'),
            value: valueLabel(t, 'difficulty', behavior.difficultyLevel || behavior.difficulty),
          },
          behavior.compatibilityWithChildren && { label: t('species.withChildren'), value: behavior.compatibilityWithChildren, wide: true },
          (behavior.compatibilityWithOtherAnimals || behavior.compatibility) && {
            label: t('species.withOtherAnimals'),
            value: behavior.compatibilityWithOtherAnimals || behavior.compatibility,
            wide: true,
          },
        ]}
      />
      <SourceNote sources={behavior.sources} />
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

export function HealthSection({ health }: { health: HealthData | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const diseases = health?.editorial?.diseases ?? [];
  const pubmed = (health?.pubmed ?? []).filter((a) => a?.title);
  const needsReview = Boolean(health?.needsReview || health?.editorial?.needsReview);
  const updatedAt = health?.editorial?.updatedAt ? new Date(health.editorial.updatedAt) : null;
  const updated =
    updatedAt && !Number.isNaN(updatedAt.getTime())
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(updatedAt)
      : null;

  return (
    <SheetSection
      id="sante"
      title={t('species.sections.health')}
      aside={needsReview ? <ToConfirm /> : updated ? <span className="font-mono text-meta text-ink-2">{t('species.updatedOn', { date: updated })}</span> : null}
    >
      <Alert severity="info" title={t('disclaimers.health')} />
      {needsReview ? <p className="m-0 text-ui text-ink-2">{t('species.review.health')}</p> : null}
      {diseases.length > 0 ? (
        <div className="grid gap-3">
          <h3 className="m-0 font-sans text-ui font-semibold text-ink">{t('species.commonDiseases')}</h3>
          <ul className="m-0 grid list-none divide-y divide-line p-0">
            {diseases.map((disease, i) => (
              <li key={`${disease.name}-${i}`} className="grid gap-3 py-4 first:pt-1 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="m-0 font-display text-h4 font-semibold text-ink">{disease.name}</h4>
                  {disease.needsReview ? <ToConfirm /> : null}
                </div>
                <FactList
                  items={[
                    disease.symptoms && { label: t('species.symptoms'), value: disease.symptoms, wide: true },
                    disease.prevention && { label: t('species.prevention'), value: disease.prevention },
                    disease.whenToConsult && { label: t('species.whenToConsult'), value: disease.whenToConsult },
                  ]}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="m-0 text-body text-ink-2">{t('species.noHealthData')}</p>
      )}
      {pubmed.length > 0 ? (
        <div className="grid gap-2">
          <div className="grid gap-0.5">
            <h3 className="m-0 font-sans text-ui font-semibold text-ink">{t('species.scientificReferences')}</h3>
            <p className="m-0 text-meta text-ink-2">{t('species.pubmedNote')}</p>
          </div>
          <ul className="m-0 grid list-none gap-2 p-0">
            {pubmed.map((article) => {
              const href = safeUrl(article.url);
              // Titres PubMed : en anglais, annoncés comme tels aux lecteurs d'écran (`lang="en"`).
              return (
                <li key={article.pmid} className="grid gap-0.5">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      lang="en"
                      className="text-accent-text underline decoration-1 underline-offset-2"
                    >
                      {article.title}
                      <span className="sr-only" lang={locale}>
                        {' '}
                        {t('plans.newTab')}
                      </span>
                    </a>
                  ) : (
                    <span lang="en" className="text-ink">
                      {article.title}
                    </span>
                  )}
                  <span className="font-mono text-meta text-ink-2">{[article.journal, article.pubDate, `PMID ${article.pmid}`].filter(Boolean).join(' · ')}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <SourceNote sources={health?.editorial?.sources} />
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

export function hasReproduction(r: ReproductionData | null | undefined): r is ReproductionData {
  return Boolean(
    r &&
      (r.season || r.gestationDays != null || r.incubationDays != null || r.litterSizeMin != null || r.litterSizeMax != null || r.sexualMaturityMonths != null || r.breedingDifficulty || r.notes),
  );
}

const BREEDING_KEYS: Record<string, 'easy' | 'moderate' | 'advanced'> = {
  facile: 'easy',
  easy: 'easy',
  modere: 'moderate',
  moderate: 'moderate',
  avance: 'advanced',
  advanced: 'advanced',
};

export function ReproductionSection({ reproduction: r }: { reproduction: ReproductionData }) {
  const t = useTranslations();
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const litter =
    r.litterSizeMin != null || r.litterSizeMax != null
      ? r.litterSizeMin != null && r.litterSizeMax != null && r.litterSizeMin !== r.litterSizeMax
        ? `${nf.format(r.litterSizeMin)}–${nf.format(r.litterSizeMax)}`
        : nf.format((r.litterSizeMin ?? r.litterSizeMax) as number)
      : null;
  const difficulty = r.breedingDifficulty ? BREEDING_KEYS[r.breedingDifficulty.toLowerCase()] : undefined;
  return (
    <SheetSection id="reproduction" title={t('species.sections.reproduction')}>
      <FactList
        items={[
          r.season && { label: t('species.reproduction.season'), value: r.season },
          r.gestationDays != null && { label: t('species.reproduction.gestation'), value: t('species.units.days', { count: r.gestationDays }), mono: true },
          r.incubationDays != null && { label: t('species.reproduction.incubation'), value: t('species.units.days', { count: r.incubationDays }), mono: true },
          litter && { label: t('species.reproduction.litterSize'), value: litter, mono: true },
          r.sexualMaturityMonths != null && {
            label: t('species.reproduction.sexualMaturity'),
            value: t('species.units.months', { count: r.sexualMaturityMonths }),
            mono: true,
          },
          r.breedingDifficulty && {
            label: t('species.reproduction.difficulty'),
            value: difficulty ? t(`species.reproduction.${difficulty}`) : r.breedingDifficulty,
          },
          r.notes && { label: t('species.reproduction.notes'), value: r.notes, wide: true },
        ]}
      />
      <SourceNote sources={r.sources} />
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

const STATUS_TONE = { allowed: 'ok', prohibited: 'danger', permit_required: 'warn' } as const;
const STATUS_KEY = { allowed: 'allowed', prohibited: 'prohibited', permit_required: 'permitRequired' } as const;

export function LegislationSection({ legislation }: { legislation: LegislationData | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const items = legislation?.editorial ?? [];
  return (
    <SheetSection id="legislation" title={t('species.sections.legislation')}>
      <Alert severity="info" title={t('disclaimers.legal')} />
      {items.length === 0 ? (
        <p className="m-0 text-body text-ink-2">{t('species.noLegalData')}</p>
      ) : (
        <ul className="m-0 grid list-none divide-y divide-line p-0">
          {items.map((item) => {
            const status = item.status as keyof typeof STATUS_TONE;
            const needsReview = Boolean(item.needsReview || item.details?.needsReview);
            const permits = item.details?.permits ?? [];
            const restrictions = item.details?.restrictions ?? [];
            return (
              <li key={item.country} className="grid gap-3 py-4 first:pt-1 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 font-display text-h4 font-semibold text-ink">{countryName(item.country, locale)}</h3>
                  {STATUS_TONE[status] ? (
                    <Badge tone={STATUS_TONE[status]} dot>
                      {t(`species.${STATUS_KEY[status]}`)}
                    </Badge>
                  ) : null}
                  {needsReview ? <ToConfirm /> : null}
                </div>
                {needsReview ? <p className="m-0 max-w-prose text-ui text-ink-2">{t('species.review.legislation')}</p> : null}
                <FactList
                  items={[
                    item.details?.citesAppendix && { label: t('species.citesStatus'), value: t('species.annex', { value: item.details.citesAppendix }), mono: true },
                    item.details?.euAnnex && { label: t('species.euRegulation'), value: t('species.annex', { value: item.details.euAnnex }), mono: true },
                    permits.length > 0 && { label: t('species.permits'), value: <InkList items={permits} />, wide: true },
                    restrictions.length > 0 && { label: t('species.restrictions'), value: <InkList items={restrictions} marker="cross" />, wide: true },
                  ]}
                />
                <SourceNote sources={item.sources} />
              </li>
            );
          })}
        </ul>
      )}
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

export function EquipmentSection({ equipment }: { equipment: EquipmentData }) {
  const t = useTranslations();
  const groups = new Map<string, NonNullable<EquipmentData['recommendations']>>();
  for (const rec of equipment.recommendations ?? []) {
    const list = groups.get(rec.category) ?? [];
    list.push(rec);
    groups.set(rec.category, list);
  }
  return (
    <SheetSection id="materiel" title={t('species.sections.equipment')}>
      <div className="grid gap-6 sm:grid-cols-2">
        {[...groups.entries()].map(([category, recs]) => (
          <div key={category} className="grid content-start gap-2">
            <h3 className="m-0 font-sans text-ui font-semibold text-ink">{valueLabel(t, 'equipment', category)}</h3>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {recs.map((rec) => (
                <li key={rec.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-body text-ink">
                  <span>{rec.label}</span>
                  {rec.size ? <span className="font-mono text-meta text-ink-2">{rec.size}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SheetSection>
  );
}

/* ----------------------------------------------------------------------------------------- */

const isWikipedia = (url: string) => /(^|\.)wikipedia\.org$/.test(hostOf(url) ?? '');

/** Toutes les sources de la fiche, dédoublonnées, avec les attributions exigées par les licences. */
export function SourcesSection({
  species,
  speciesId,
  sectionSources,
  photo,
  pubmedCount = 0,
}: {
  species: SpeciesData;
  speciesId: number;
  sectionSources: Array<SourceRef | string>;
  photo: SpeciesPhoto | null;
  /** Articles PubMed cités dans la section santé (listés là-bas, avec leurs liens). */
  pubmedCount?: number;
}) {
  const t = useTranslations();
  const description = safeUrl(species.profile?.sourceUrl);
  const seen = new Set<string>();
  const references: Array<{ url: string; title: string }> = [];
  for (const raw of sectionSources) {
    const ref = typeof raw === 'string' ? { url: raw } : raw;
    const url = safeUrl(ref.url);
    if (!url || seen.has(url) || url === description) continue;
    seen.add(url);
    references.push({ url, title: ref.title?.trim() || hostOf(url) || url });
  }
  const linkClass = 'text-accent-text underline decoration-1 underline-offset-2';

  return (
    <SheetSection id="sources" title={t('species.sections.sources')}>
      <ul className="m-0 grid list-none gap-3 p-0 text-ui text-ink">
        {description ? (
          <li className="grid gap-0.5">
            <span className="text-meta text-ink-2">{t('species.sourceLabels.description')}</span>
            <span>
              <a href={description} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {isWikipedia(description) ? t('attribution.wikipediaName') : hostOf(description)}
              </a>
              {isWikipedia(description) ? <span className="font-mono text-meta text-ink-2"> · {t('attribution.license')}</span> : null}
            </span>
          </li>
        ) : null}
        {isGbifKey(speciesId) ? (
          <li className="grid gap-0.5">
            <span className="text-meta text-ink-2">{t('species.sourceLabels.taxonomy')}</span>
            <span>
              <a href={`https://www.gbif.org/species/${speciesId}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {t('attribution.gbifName')}
              </a>
              <span className="font-mono text-meta text-ink-2"> · GBIF {speciesId}</span>
            </span>
          </li>
        ) : null}
        {photo ? (
          <li className="grid gap-0.5">
            <span className="text-meta text-ink-2">{t('species.sourceLabels.photo')}</span>
            <span>
              <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {photo.author}
              </a>
              <span className="font-mono text-meta text-ink-2">
                {' · '}
                <a href={photo.license.url} target="_blank" rel="noopener noreferrer license" className="text-ink-2 underline decoration-1 underline-offset-2">
                  {photo.license.label}
                </a>
                {' · '}
                {t('species.sourceLabels.viaGbif')}
              </span>
            </span>
          </li>
        ) : null}
        {pubmedCount > 0 ? (
          <li className="grid gap-0.5">
            <span className="text-meta text-ink-2">{t('species.sourceLabels.pubmed')}</span>
            <a href="#sante" className={`${linkClass} justify-self-start`}>
              {t('species.pubmedNote')}
            </a>
          </li>
        ) : null}
        {references.length > 0 ? (
          <li className="grid gap-1.5">
            <span className="text-meta text-ink-2">{t('species.sourceLabels.references')}</span>
            <ol className="m-0 grid list-none gap-1.5 p-0">
              {references.map((ref, i) => (
                <li key={ref.url} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline gap-2">
                  <span className="font-mono text-meta text-ink-2">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">
                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className={`${linkClass} break-words`}>
                      {ref.title}
                    </a>
                    <span className="font-mono text-meta text-ink-2"> · {hostOf(ref.url)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ) : null}
      </ul>
    </SheetSection>
  );
}
