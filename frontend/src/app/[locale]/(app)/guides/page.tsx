'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Animal } from '@/lib/api';
import { GUIDE_CATEGORIES, guideCategoryForSpecies, guidePath, isGuideCategory } from '@/lib/guides';
import { normalizeSpeciesResult, speciesDisplayName, type SpeciesSummary } from '@/lib/species';
import { speciesPath } from '@/lib/platform';
import { photoSources } from '@/content/photos';
import { HabitatPlan, parseHabitatDimensions } from '@/components/guides/HabitatPlan';
import { GUIDE_SOURCES } from '@/content/habitat-guides';
import { Alert, Button, Card, ExternalLink, Field, Figure, LoadingPage, SectionHeader, buttonClasses } from '@/components/ui';
import { HabitatSection, EquipmentSection, FeedingSection, BehaviorSection } from '../species/[id]/_components/sections';
import type { EquipmentData, SpeciesData } from '../species/[id]/_components/types';

type Sheet = { id: string; species: SpeciesData; equipment: EquipmentData | null };

function GuideView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { token } = useAuth();
  const id = params.get('species');
  const requestedCategory = params.get('category');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [animals, setAnimals] = useState<{ token: string; items: Animal[] } | null>(null);
  const [animalError, setAnimalError] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState<SpeciesSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) return;
    let cancelled = false;
    Promise.all([
      api.getSpecies(id) as Promise<SpeciesData>,
      api.getRecommendedEquipment(Number(id)).catch(() => null) as Promise<EquipmentData | null>,
    ]).then(([species, equipment]) => {
      if (!cancelled) { setSheet({ id, species, equipment }); setFailure(null); }
    }).catch(() => { if (!cancelled) setFailure(id); });
    return () => { cancelled = true; };
  }, [id, attempt]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.getMyAnimals(token).then((items) => {
      if (!cancelled) { setAnimals({ token, items }); setAnimalError(false); }
    }).catch(() => { if (!cancelled) setAnimalError(true); });
    return () => { cancelled = true; };
  }, [token, attempt]);

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    api.searchSpecies(query, 12, 0).then((data) => {
      if (!cancelled) {
        setResults((data.results ?? []).map(normalizeSpeciesResult).filter((s): s is SpeciesSummary => s !== null));
        setSearchError(false); setSearching(false);
      }
    }).catch(() => { if (!cancelled) { setSearchError(true); setSearching(false); } });
    return () => { cancelled = true; };
  }, [query, attempt]);

  const current = sheet?.id === id ? sheet : null;
  const classified = current ? guideCategoryForSpecies(current.species) : null;
  const isFish = Boolean(current && /Actinopterygii|Chondrichthyes|Sarcopterygii|Teleostei|poisson|fish/i.test([current.species.class, current.species.profile?.category].join(' ')));
  const explicitCategory = isGuideCategory(requestedCategory) ? requestedCategory : null;
  const category = classified || (isFish && explicitCategory && !['freshwater', 'marine'].includes(explicitCategory) ? null : explicitCategory);
  const chosen = GUIDE_CATEGORIES.find((c) => c.id === category);
  const personalAnimals = token && animals?.token === token ? animals.items : [];
  const invalidId = id !== null && !/^\d+$/.test(id);
  const needsCategoryChoice = current && !category;
  const needsWaterChoice = needsCategoryChoice && isFish;
  const habitat = current?.species.habitat;
  const documentedHabitat = habitat?.sources?.some((source) => source.url?.startsWith('https://')) ? habitat : null;

  function search(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length < 2) return;
    setSearching(true); setResults(null); setSearchError(false);
    if (query === text.trim()) setAttempt((value) => value + 1);
    else setQuery(text.trim());
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <SectionHeader title={t('guides.title')} description={t('guides.intro')} />
      <Card as="section" title={t('guides.chooseSpecies')} titleId="guide-species-picker">
        <div className="grid gap-4 sm:grid-cols-2">
          {token ? <Field label={t('guides.myAnimals')} hint={animalError ? t('guides.animalsError') : undefined}>
            <select value={personalAnimals.some((animal) => animal.id === params.get('animal')) ? params.get('animal')! : ''}
              onChange={(event) => {
                const animal = personalAnimals.find((item) => item.id === event.target.value);
                router.replace(animal ? `${guidePath(animal.speciesId)}&animal=${encodeURIComponent(animal.id)}` : guidePath());
              }}>
              <option value="">{t('guides.chooseAnimal')}</option>
              {personalAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name}</option>)}
            </select>
          </Field> : null}
          <form onSubmit={search} className="grid gap-2">
            <Field label={t('guides.searchSpecies')} hint={t('guides.searchHint')}>
              <input type="search" value={text} onChange={(event) => setText(event.target.value)} minLength={2} maxLength={120} />
            </Field>
            <Button type="submit" loading={searching} disabled={text.trim().length < 2}>{t('guides.search')}</Button>
          </form>
        </div>
        {token && animalError ? <Button variant="quiet" onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</Button> : null}
        <div aria-live="polite">
          {searchError ? <Alert severity="warning" title={t('guides.loadError')} /> : null}
          {results?.length === 0 ? <p className="text-ink-2">{t('guides.noResults')}</p> : null}
          {results && results.length > 0 ? <ul className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
            {results.map((species) => <li key={species.id}>
              <Link href={guidePath(species.id)} className={buttonClasses({ variant: 'secondary', wrap: true, className: 'w-full justify-start text-left' })}>
                {speciesDisplayName(locale, species.commonNameFr, species.latin).name}
                <span className="font-mono text-meta text-ink-2">{species.latin}</span>
              </Link>
            </li>)}
          </ul> : null}
        </div>
      </Card>

      <section aria-labelledby="guide-categories">
        <h2 id="guide-categories" className="font-display text-h3">{t('guides.categoriesTitle')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {GUIDE_CATEGORIES.map((item) => <Link key={item.id}
            href={`/guides?category=${item.id}${isFish && ['freshwater', 'marine'].includes(item.id) ? `&species=${id}` : ''}`}
            aria-current={category === item.id ? 'page' : undefined}
            className={buttonClasses({ variant: category === item.id ? 'primary' : 'secondary', wrap: true, className: 'text-center' })}>
            {t(`guides.categories.${item.id}.title`)}
          </Link>)}
        </div>
      </section>

      {invalidId || failure === id && id ? <Alert severity="warning" title={t('guides.loadError')}>
        <Button variant="quiet" onClick={() => { setFailure(null); setAttempt((value) => value + 1); }}>{t('common.retry')}</Button>
      </Alert> : id && !current ? <LoadingPage /> : null}
      {needsCategoryChoice ? <Alert severity="info" title={t(needsWaterChoice ? 'guides.chooseWater' : 'guides.unknownCategory')} /> : null}

      {current ? <Card as="section" title={speciesDisplayName(locale, current.species.profile?.commonNameFr, current.species.profile?.scientificName || current.species.scientificName).name} titleId="guide-selected-species">
        <p className="mt-0 text-ink-2">{t('guides.speciesIntro')}</p>
        {documentedHabitat ? <HabitatSection habitat={documentedHabitat} distribution={null} /> : <Alert severity="info" title={t('guides.noHabitat')} />}
        {!documentedHabitat?.minSpaceSize && !documentedHabitat?.spaceRequirements ? <p className="text-ink-2">{t('guides.noDimensions')}</p> : null}
        {current.species.behavior?.sources?.some((source) => source.url?.startsWith('https://')) ? <BehaviorSection behavior={current.species.behavior} /> : null}
        {current.species.feeding?.sources?.some((source) => source.url?.startsWith('https://')) ? <FeedingSection feeding={current.species.feeding} /> : null}
        {current.equipment ? <EquipmentSection equipment={current.equipment} /> : <p className="text-ink-2">{t('guides.noEquipment')}</p>}
        <Link href={`/magasin${current.species.profile?.category ? `?category=${encodeURIComponent(current.species.profile.category)}` : ''}#store-category-filter`} className={buttonClasses({ variant: 'primary' })}>{t('guides.shopForAnimal')}</Link>
        <p className="mt-2 text-meta text-ink-2">{t('guides.planShopHint')}</p>
        <Link href={speciesPath(current.id)} className={buttonClasses({ variant: 'secondary' })}>{t('guides.fullSpecies')}</Link>
      </Card> : null}

      {chosen && category ? <div className="grid gap-6" key={`${category}:${id ?? 'general'}`}>
        <Card as="section" title={t(`guides.categories.${category}.title`)} titleId="guide-category-title">
          <p className="mt-0 text-ink-2">{t('guides.categoryScope')}</p>
          {chosen.photo ? <Figure {...photoSources(chosen.photo)} ratio="16/9" alt={t(`guides.categories.${category}.title`)} className="mb-5 max-w-2xl" /> : null}
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-h4">{t('guides.installation')}</h3>
              <ol className="grid gap-3 pl-5">
                {['space', 'setup', 'care'].map((step) => <li key={step} className="pl-1 text-body">{t(`guides.categories.${category}.${step}`)}</li>)}
              </ol>
            </div>
            <div>
              <h3 className="font-display text-h4">{t('guides.checklist')}</h3>
              <p className="text-meta text-ink-2">{t('guides.checklistHint')}</p>
              <ul className="grid list-none gap-2 p-0">
                {[0, 1, 2, 3, 4].map((index) => <li key={index}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-line px-3 py-2">
                    <input type="checkbox" className="shrink-0" />
                    <span>{t(`guides.categories.${category}.equipment.e${index}`)}</span>
                  </label>
                </li>)}
              </ul>
            </div>
          </div>
        </Card>
        <HabitatPlan storageKey={`${category}${id ? `-${id}` : ''}`} suggestedDimensions={parseHabitatDimensions(documentedHabitat?.minSpaceSize)} equipment={[0, 1, 2, 3, 4].map((index) => t(`guides.categories.${category}.equipment.e${index}`))} />
        {category === 'freshwater' || category === 'marine' ? <Card as="section" title={t('guides.diagramsTitle')} titleId="guide-aquarium-diagrams">
          <div className="grid gap-6 sm:grid-cols-2">
            <Figure {...photoSources('guideAquariumFilter')} fit="contain" ratio="16/9" alt={t('guides.filterDiagram')} caption={t('guides.filterDiagram')} />
            <Figure {...photoSources('guideNitrogenCycle')} fit="contain" ratio="16/9" alt={t('guides.cycleDiagram')} caption={t('guides.cycleDiagram')} />
          </div>
        </Card> : null}
        <Card as="section" title={t('guides.sources')} titleId="guide-sources">
          <ul className="grid list-none gap-3 p-0">
            {GUIDE_SOURCES[category].map((source) => <li key={source.url}>
              <ExternalLink href={source.url} lang="en" className="text-accent-text underline underline-offset-2">{source.title}</ExternalLink>
            </li>)}
          </ul>
        </Card>
      </div> : <p className="text-ink-2">{t('guides.start')}</p>}
    </div>
  );
}

export default function GuidesPage() {
  return <Suspense fallback={<LoadingPage />}><GuideView /></Suspense>;
}
