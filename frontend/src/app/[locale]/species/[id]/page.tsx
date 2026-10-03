'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api, type SpeciesReproduction } from '@/lib/api';
import { countryName } from '@/lib/country';
import { useAuth } from '@/contexts/AuthContext';
import * as Tabs from '@radix-ui/react-tabs';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';

interface Disease {
  name: string;
  symptoms: string;
  prevention?: string;
  whenToConsult?: string;
}

interface Source {
  type: string;
  url: string;
  title: string;
}

interface HealthData {
  editorial?: {
    diseases?: Disease[];
    sources?: Source[];
  };
  pubmed?: Array<{
    pmid: string;
    title: string;
    journal: string;
    pubDate: string;
    url: string;
  }>;
}

interface LegislationItem {
  country: string;
  status: string;
  details: {
    citesAppendix?: string | null;
    euAnnex?: string | null;
    permits?: string[];
    restrictions?: string[];
  };
  sources?: string[];
}

interface LegislationData {
  speciesId?: number;
  editorial?: LegislationItem[];
  disclaimer?: string;
}

interface EquipmentRecommendation {
  id: string;
  category: string;
  label: string;
  size?: string;
  searchTerms?: string[];
}

interface EquipmentData {
  recommendations?: EquipmentRecommendation[];
  affiliate?: {
    disclaimer?: string;
  };
}

interface FoodProduct {
  code: string;
  product_name?: string;
  image_url?: string;
  brands?: string;
  categories?: string;
  nutriments?: Record<string, unknown>;
}

interface SpeciesFoodEntry {
  name?: string;
  frequency?: string;
  notes?: string;
  reason?: string;
}

/** Vrai pour une URL Wikipédia (http/https) : seules ces sources exigent l'attribution CC BY-SA. */
function isWikipediaUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && /(^|\.)wikipedia\.org$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** Les speciesId ≥ 2 000 000 001 sont des races artificielles, absentes de GBIF. */
function isGbifKey(speciesId?: number): boolean {
  return typeof speciesId === 'number' && speciesId > 0 && speciesId < 2_000_000_001;
}

/** Fiche espèce telle que renvoyée par GET /species/:id (champs utilisés par cette page) */
interface SpeciesData {
  scientificName: string;
  canonicalName?: string;
  rank?: string;
  iucnStatus?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  distribution?: string | string[];
  biome?: string;
  profile?: {
    speciesId?: number;
    sourceUrl?: string | null;
    commonNameFr?: string;
    scientificName?: string;
    category?: string;
    subcategory?: string;
    domesticationType?: string;
    description?: string;
  };
  habitat?: {
    habitatType?: string;
    temperature?: string;
    humidity?: string;
    spaceRequirements?: string;
    lighting?: string;
    enrichment?: string;
  };
  behavior?: {
    generalBehavior?: string;
    sociability?: string;
    difficulty?: string;
    compatibility?: string;
  };
  feeding?: {
    dietType?: string;
    mealFrequency?: string;
    feedingFrequency?: string;
    recommendedFoods?: SpeciesFoodEntry[] | string;
    foodsToAvoid?: SpeciesFoodEntry[] | string;
    avoidedFoods?: SpeciesFoodEntry[] | string;
    specificNeeds?: string;
  };
}

/** Returns a valid URL string for href, or '#' to avoid "The string did not match the expected pattern" */
function safeHref(value: string | undefined | null): string {
  if (value == null || typeof value !== 'string' || value.trim() === '') return '#';
  const trimmed = value.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return '#';
  }
}

interface StoreItem {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  categories: string[];
  types: string[];
}

function MagasinTabContent({ category }: { category?: string | null }) {
  const t = useTranslations();
  // Résultat chargé, associé à la catégorie demandée : `loading` est dérivé (pas de setState synchrone dans l'effet)
  const [result, setResult] = useState<{ category: string | null; stores: StoreItem[] } | null>(null);
  const requestedCategory = category ?? null;
  const loading = result === null || result.category !== requestedCategory;
  const stores = result?.stores ?? [];

  useEffect(() => {
    let cancelled = false;
    api
      .getAffiliateStores(category || undefined, undefined)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setResult({ category: category ?? null, stores: list });
      })
      .catch(() => {
        if (!cancelled) setResult({ category: category ?? null, stores: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }
  if (stores.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 italic">
        {t('species.noPartnerStores')}
      </p>
    );
  }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {stores.map((store) => {
        const href = safeHref(store.url);
        return (
          <div
            key={store.id}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-800 dark:text-white mb-1">{store.name}</h3>
            {store.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{store.description}</p>
            )}
            {href !== '#' && (
              <a
                href={href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t('store.visitStore')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SpeciesDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, token } = useAuth();
  const [resolvedParams, setResolvedParams] = useState<{
    locale: string;
    id: string;
  } | null>(null);
  const [species, setSpecies] = useState<SpeciesData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [legislation, setLegislation] = useState<LegislationData | null>(null);
  const [equipment, setEquipment] = useState<EquipmentData | null>(null);
  const [food, setFood] = useState<FoodProduct[]>([]);
  const [reproduction, setReproduction] = useState<SpeciesReproduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<'not_found' | 'generic' | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;
    setFood([]);
    setFoodError(null);

    const fetchData = async () => {
      setError(null);
      try {
        const [speciesData, healthData, legislationData, equipmentData, reproductionData] =
          await Promise.all([
            api.getSpecies(resolvedParams.id),
            api.getSpeciesHealth(resolvedParams.id, undefined, resolvedParams.locale).catch(() => null),
            api.getSpeciesLegislation(resolvedParams.id).catch(() => null),
            api.getRecommendedEquipment(parseInt(resolvedParams.id)).catch(() => null),
            api.getSpeciesReproduction(resolvedParams.id).catch(() => null),
          ]);

        setSpecies(speciesData as SpeciesData);
        setHealth(healthData as HealthData | null);
        setLegislation(legislationData as LegislationData | null);
        setEquipment(equipmentData as EquipmentData | null);
        setReproduction(reproductionData as SpeciesReproduction | null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Species not found' || message.includes('not found')) {
          setError('not_found');
        } else {
          setError('generic');
          console.error('Error fetching species data:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams]);

  // Fetch food data when tab is selected
  const fetchFoodData = async () => {
    if (!species || foodLoading) return;
    if (food.length > 0 && !foodError) return;

    setFoodLoading(true);
    setFoodError(null);
    try {
      const speciesName = species.canonicalName || species.scientificName;
      const result = await api.getFoodBySpecies(speciesName) as { products?: FoodProduct[] };
      setFood(result?.products || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('species.noFoodData');
      setFoodError(message);
      setFood([]);
    } finally {
      setFoodLoading(false);
    }
  };

  const getStatusLabel = (status?: string): string => {
    const labels: Record<string, string> = {
      allowed: t('species.allowed'),
      prohibited: t('species.prohibited'),
      permit_required: t('species.permitRequired'),
    };
    return labels[status || ''] || status || '-';
  };

  const getStatusColor = (status?: string): string => {
    const colors: Record<string, string> = {
      allowed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      prohibited: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      permit_required: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return colors[status || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getBreedingDifficultyLabel = (difficulty?: string | null): string => {
    if (!difficulty) return '-';
    const labels: Record<string, string> = {
      easy: t('species.reproduction.easy'),
      moderate: t('species.reproduction.moderate'),
      advanced: t('species.reproduction.advanced'),
    };
    return labels[difficulty] || difficulty;
  };

  const hasReproductionData = (r: SpeciesReproduction | null): boolean => {
    if (!r) return false;
    return !!(
      r.season ||
      r.gestationDays != null ||
      r.incubationDays != null ||
      r.litterSizeMin != null ||
      r.litterSizeMax != null ||
      r.sexualMaturityMonths != null ||
      r.breedingDifficulty ||
      r.notes
    );
  };

  const handleAddToMyAnimals = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!species) return;
    // Navigate to mes-animaux with species pre-selected
    const speciesName = species.canonicalName || species.scientificName;
    router.push(`/mes-animaux?addSpecies=${resolvedParams?.id}&speciesName=${encodeURIComponent(speciesName)}`);
  };

  if (loading || !resolvedParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (error === 'not_found' || (!loading && !species && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {t('species.notFound')}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-emerald-600 hover:text-emerald-700"
          >
            {t('common.back')} {t('common.home')}
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'generic') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {t('common.error')}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-emerald-600 hover:text-emerald-700"
          >
            {t('common.back')} {t('common.home')}
          </Link>
        </div>
      </div>
    );
  }

  if (!species) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Species Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-8 sm:py-12 min-w-0">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 break-words">
                {species.profile?.commonNameFr || species.canonicalName || species.scientificName}
              </h1>
              <p className="text-base sm:text-lg md:text-xl italic opacity-90 truncate">{species.scientificName}</p>
              <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4 flex-wrap">
                {species.profile?.category && (
                  <span className="px-4 py-2 bg-white/20 rounded-full text-sm capitalize">
                    {species.profile.category}
                  </span>
                )}
                {species.profile?.domesticationType && (
                  <span className="px-4 py-2 bg-white/20 rounded-full text-sm capitalize">
                    {species.profile.domesticationType}
                  </span>
                )}
                {species.rank && (
                  <span className="px-4 py-2 bg-white/20 rounded-full text-sm">
                    {species.rank}
                  </span>
                )}
                {species.iucnStatus && (
                  <span className="px-4 py-2 bg-red-500/80 rounded-full text-sm">
                    IUCN: {species.iucnStatus}
                  </span>
                )}
              </div>
            </div>
            
            {/* Add to My Animals button */}
            <button
              onClick={handleAddToMyAnimals}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('species.addToMyAnimals')}
            </button>
          </div>
        </div>
      </div>

      {/* Content with Tabs */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <Tabs.Root defaultValue="overview" className="w-full min-w-0">
          <Tabs.List className="flex border-b border-gray-200 dark:border-gray-700 mb-6 sm:mb-8 overflow-x-auto pb-px -mx-1 px-1 gap-0 scrollbar-thin [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
            <Tabs.Trigger
              value="overview"
              className="px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t('species.overview')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="health"
              className="px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t('species.health')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="legal"
              className="px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t('species.legal')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="food"
              onClick={fetchFoodData}
              className="px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t('species.food')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="equipment"
              className="px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t('species.equipment')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="magasin"
              className="px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t('species.shop')}
            </Tabs.Trigger>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Content value="overview" className="space-y-6 min-w-0 overflow-x-hidden">
            {/* Identification (Profile) */}
            {species.profile && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('species.identification')} / {t('species.profileLabel')}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {species.profile.commonNameFr && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('species.commonNameFr')}</span>{' '}
                      <span className="font-semibold">{species.profile.commonNameFr}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{t('species.scientificName')} :</span>{' '}
                    <span className="font-semibold">{species.profile.scientificName}</span>
                  </div>
                  {species.profile.category && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('species.category')}</span>{' '}
                      <span className="font-semibold capitalize">{species.profile.category}</span>
                    </div>
                  )}
                  {species.profile.subcategory && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('species.subcategory')}</span>{' '}
                      <span className="font-semibold">{species.profile.subcategory}</span>
                    </div>
                  )}
                  {species.profile.domesticationType && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('species.domesticationType')}</span>{' '}
                      <span className="font-semibold capitalize">{species.profile.domesticationType}</span>
                    </div>
                  )}
                </div>
                {species.profile.description && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                      {t('species.description')}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{species.profile.description}</p>
                  </div>
                )}
                {/* Attributions (licences des données — W2-06) */}
                {(isWikipediaUrl(species.profile.sourceUrl) || isGbifKey(species.profile.speciesId)) && (
                  <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    {isWikipediaUrl(species.profile.sourceUrl) && (
                      <p>
                        {t('attribution.wikipediaPrefix')}{' '}
                        <a
                          href={species.profile.sourceUrl as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {t('attribution.wikipediaName')}
                        </a>{' '}
                        — {t('attribution.license')}
                      </p>
                    )}
                    {isGbifKey(species.profile.speciesId) && (
                      <p>
                        {t('attribution.gbifPrefix')}{' '}
                        <a
                          href={`https://www.gbif.org/species/${species.profile.speciesId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {t('attribution.gbifName')}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Classification */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.classification')}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('species.kingdom')}</span>{' '}
                  <span className="font-semibold">{species.kingdom || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('species.phylum')}</span>{' '}
                  <span className="font-semibold">{species.phylum || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('species.class')}</span>{' '}
                  <span className="font-semibold">{species.class || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('species.order')}</span>{' '}
                  <span className="font-semibold">{species.order || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('species.family')}</span>{' '}
                  <span className="font-semibold">{species.family || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('species.genus')}</span>{' '}
                  <span className="font-semibold">{species.genus || '-'}</span>
                </div>
              </div>
            </div>

            {/* Habitat Editorial Data */}
            {species.habitat && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('species.habitatEditorial')}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {species.habitat.habitatType && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                        {t('species.habitatType')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.habitat.habitatType}</p>
                    </div>
                  )}
                  {species.habitat.temperature && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        {t('species.temperature')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.habitat.temperature}</p>
                    </div>
                  )}
                  {species.habitat.humidity && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        {t('species.humidity')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.habitat.humidity}</p>
                    </div>
                  )}
                  {species.habitat.spaceRequirements && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                        {t('species.spaceRequirements')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.habitat.spaceRequirements}</p>
                    </div>
                  )}
                  {species.habitat.lighting && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                        {t('species.lighting')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.habitat.lighting}</p>
                    </div>
                  )}
                  {species.habitat.enrichment && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                        {t('species.enrichment')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.habitat.enrichment}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Behavior Editorial Data */}
            {species.behavior && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('species.behavior')}
                </h2>
                <div className="space-y-4">
                  {species.behavior.generalBehavior && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <h3 className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2">
                        {t('species.generalBehavior')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.behavior.generalBehavior}</p>
                    </div>
                  )}
                  {species.behavior.sociability && (
                    <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                      <h3 className="font-semibold text-pink-800 dark:text-pink-200 mb-2">
                        {t('species.sociability')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.behavior.sociability}</p>
                    </div>
                  )}
                  {species.behavior.difficulty && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                        {t('species.difficultyLevel')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.behavior.difficulty}</p>
                    </div>
                  )}
                  {species.behavior.compatibility && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                        {t('species.compatibility')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.behavior.compatibility}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reproduction (Module B) - affiché uniquement si données disponibles */}
            {hasReproductionData(reproduction) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('species.reproduction.title')}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reproduction!.season && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                        {t('species.reproduction.season')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{reproduction!.season}</p>
                    </div>
                  )}
                  {reproduction!.gestationDays != null && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        {t('species.reproduction.gestationDays')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{reproduction!.gestationDays}</p>
                    </div>
                  )}
                  {reproduction!.incubationDays != null && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        {t('species.reproduction.incubationDays')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{reproduction!.incubationDays}</p>
                    </div>
                  )}
                  {(reproduction!.litterSizeMin != null || reproduction!.litterSizeMax != null) && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                        {t('species.reproduction.litterSize')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        {reproduction!.litterSizeMin != null ? reproduction!.litterSizeMin : '?'}
                        {reproduction!.litterSizeMax != null &&
                        reproduction!.litterSizeMax !== reproduction!.litterSizeMin
                          ? ` - ${reproduction!.litterSizeMax}`
                          : ''}
                      </p>
                    </div>
                  )}
                  {reproduction!.sexualMaturityMonths != null && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                        {t('species.reproduction.sexualMaturity')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        {reproduction!.sexualMaturityMonths} {t('species.reproduction.months')}
                      </p>
                    </div>
                  )}
                  {reproduction!.breedingDifficulty && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                        {t('species.reproduction.difficulty')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        {getBreedingDifficultyLabel(reproduction!.breedingDifficulty)}
                      </p>
                    </div>
                  )}
                  {reproduction!.notes && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg md:col-span-2 lg:col-span-3">
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                        {t('species.reproduction.notes')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{reproduction!.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Environment / Habitat (from species object) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.environment')} / {t('species.habitat')}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {species.habitat && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                      {t('species.habitat')}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      {typeof species.habitat === 'object' && species.habitat !== null
                        ? species.habitat.habitatType ?? '—'
                        : String(species.habitat)}
                    </p>
                  </div>
                )}
                {species.distribution && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      {t('species.distribution')}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      {typeof species.distribution === 'string'
                        ? species.distribution
                        : Array.isArray(species.distribution)
                          ? species.distribution.join(', ')
                          : '—'}
                    </p>
                  </div>
                )}
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                    {t('species.biome')}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {species.biome || t('species.defaultBiome')}
                  </p>
                </div>
              </div>
              {!species.habitat && !species.distribution && (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  {t('species.environmentDataMissing')}
                </p>
              )}
            </div>
          </Tabs.Content>

          {/* Health Tab */}
          <Tabs.Content value="health" className="space-y-6 min-w-0 overflow-x-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.health')}
              </h2>
              
              {/* Disclaimer */}
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('disclaimers.health')}
                </p>
              </div>

              {/* Diseases */}
              {health?.editorial?.diseases && health.editorial.diseases.length > 0 ? (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {t('species.commonDiseases')}
                  </h3>
                  {health.editorial.diseases.map((disease, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        {disease.name}
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {t('species.symptoms')}:
                          </span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">
                            {disease.symptoms}
                          </p>
                        </div>
                        {disease.prevention && (
                          <div>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {t('species.prevention')}:
                            </span>
                            <p className="text-gray-700 dark:text-gray-300 mt-1">
                              {disease.prevention}
                            </p>
                          </div>
                        )}
                        {disease.whenToConsult && (
                          <div>
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {t('species.whenToConsult')}:
                            </span>
                            <p className="text-gray-700 dark:text-gray-300 mt-1">
                              {disease.whenToConsult}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Sources */}
                  {health.editorial?.sources && health.editorial.sources.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        {t('species.sources')} :
                      </h4>
                      <ul className="space-y-1">
                        {health.editorial.sources.map((source, idx) => {
                          const href = safeHref(source?.url);
                          return (
                            <li key={idx}>
                              {href !== '#' ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700 text-sm"
                                >
                                  {source.title}
                                </a>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-400 text-sm">{source.title}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  {t('species.noHealthData')}
                </p>
              )}

              {/* PubMed references */}
              {health?.pubmed && health.pubmed.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                    {t('species.scientificReferences')}
                  </h3>
                  <div className="space-y-3">
                    {health.pubmed.map((article) => {
                      const articleHref = safeHref(article?.url);
                      return (
                      <div
                        key={article.pmid}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {articleHref !== '#' ? (
                          <a
                            href={articleHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 font-semibold"
                          >
                            {article.title}
                          </a>
                        ) : (
                          <span className="font-semibold text-gray-800 dark:text-white">{article.title}</span>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {article.journal} - {article.pubDate}
                        </p>
                      </div>
                    );})}
                  </div>
                </div>
              )}
            </div>
          </Tabs.Content>

          {/* Legal Tab */}
          <Tabs.Content value="legal" className="space-y-6 min-w-0 overflow-x-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.legal')}
              </h2>
              
              {/* Disclaimer */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {t('disclaimers.legal')}
                </p>
              </div>

              {legislation?.editorial && legislation.editorial.length > 0 ? (
                <div className="space-y-8">
                  {legislation.editorial.map((item) => (
                    <div key={item.country} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-700/30">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                          {countryName(item.country, locale)}
                        </h3>
                        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      {item.details?.citesAppendix && (
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg mb-3">
                          <h4 className="font-semibold text-gray-800 dark:text-white mb-1">{t('species.citesStatus')}</h4>
                          <p className="text-gray-700 dark:text-gray-300">{t('species.annex', { value: item.details.citesAppendix })}</p>
                        </div>
                      )}

                      {item.details?.euAnnex && (
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg mb-3">
                          <h4 className="font-semibold text-gray-800 dark:text-white mb-1">{t('species.euRegulation')}</h4>
                          <p className="text-gray-700 dark:text-gray-300">{t('species.annex', { value: item.details.euAnnex })}</p>
                        </div>
                      )}

                      {item.details?.permits && item.details.permits.length > 0 && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
                          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">{t('species.permits')}</h4>
                          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-sm">
                            {item.details.permits.map((permit, idx) => (
                              <li key={idx}>{permit}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.details?.restrictions && item.details.restrictions.length > 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-3">
                          <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">{t('species.restrictions')}</h4>
                          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-sm">
                            {item.details.restrictions.map((restriction, idx) => (
                              <li key={idx}>{restriction}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.sources && item.sources.length > 0 && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                          <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-1 text-sm">{t('species.sources')}</h4>
                          <ul className="space-y-0.5">
                            {item.sources.map((source, idx) => {
                              const srcHref = safeHref(source);
                              return (
                                <li key={idx}>
                                  {srcHref !== '#' ? (
                                    <a href={srcHref} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm break-all">
                                      {source}
                                    </a>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400 text-sm">{source}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  {t('species.noLegalData')}
                </p>
              )}
            </div>
          </Tabs.Content>

          {/* Food Tab */}
          <Tabs.Content value="food" className="space-y-6">
            {/* Editorial Feeding Data (from DB, adapted to species) */}
            {species.feeding && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('species.feedingTitle')}
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {species.feeding.dietType && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                        {t('species.dietType')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{species.feeding.dietType}</p>
                    </div>
                  )}
                  {(species.feeding.mealFrequency || species.feeding.feedingFrequency) && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        {t('species.mealFrequency')}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        {species.feeding.mealFrequency || species.feeding.feedingFrequency}
                      </p>
                    </div>
                  )}
                </div>
                {(() => {
                  const rec = species.feeding.recommendedFoods;
                  if (!rec) return null;
                  const list = Array.isArray(rec)
                    ? rec.map((r: { name?: string; frequency?: string; notes?: string }) =>
                        [r.name, r.frequency, r.notes].filter(Boolean).join(' — ')
                      )
                    : [String(rec)];
                  return (
                    <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                        {t('species.recommendedFoods')}
                      </h3>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                        {list.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {(() => {
                  const avoid = species.feeding.foodsToAvoid ?? species.feeding.avoidedFoods;
                  if (!avoid) return null;
                  const list = Array.isArray(avoid)
                    ? avoid.map((a: { name?: string; reason?: string }) =>
                        a.reason ? `${a.name}: ${a.reason}` : String(a.name ?? a)
                      )
                    : [String(avoid)];
                  return (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                        {t('species.foodsToAvoid')}
                      </h3>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                        {list.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {species.feeding.specificNeeds && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      {t('species.specificNeeds')}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{species.feeding.specificNeeds}</p>
                  </div>
                )}
              </div>
            )}

            {/* Food Products (Open Pet Food Facts + backend mapping by species) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.foodRecommendations')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t('species.foodSource')}
              </p>

              {foodLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
                </div>
              ) : foodError ? (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">{foodError}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    {t('species.foodReferenceNote')}
                  </p>
                </div>
              ) : food.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {food.map((product) => (
                    <div
                      key={product.code}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.product_name}
                          className="w-full h-32 object-contain mb-3"
                        />
                      )}
                      <h3 className="font-semibold text-gray-800 dark:text-white mb-1">
                        {product.product_name || t('species.unnamedProduct')}
                      </h3>
                      {product.brands && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {product.brands}
                        </p>
                      )}
                      {product.categories && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {product.categories.split(',').slice(0, 2).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic text-center py-8">
                  {t('species.noFoodData')}
                </p>
              )}
            </div>
          </Tabs.Content>

          {/* Equipment Tab */}
          <Tabs.Content value="equipment" className="space-y-6 min-w-0 overflow-x-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.equipment')}
              </h2>
              
              {equipment?.recommendations && equipment.recommendations.length > 0 ? (
                <div className="space-y-6">
                  {/* Group by category */}
                  {Object.entries(
                    equipment.recommendations.reduce((acc, rec) => {
                      const cat = rec.category;
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(rec);
                      return acc;
                    }, {} as Record<string, EquipmentRecommendation[]>)
                  ).map(([category, items]) => (
                    <div key={category} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 capitalize">
                        {category}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {items.map((rec) => (
                          <div
                            key={rec.id}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                          >
                            <p className="font-medium text-gray-800 dark:text-white">
                              {rec.label}
                            </p>
                            {rec.size && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Taille: {rec.size}
                              </p>
                            )}
                            <span className="inline-block mt-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                              {t('disclaimers.affiliate')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  {t('species.noEquipmentData')}
                </p>
              )}

              {/* Transparency link */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('store.productLinksNotice')}{' '}
                  <Link
                    href="/transparency"
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    {t('footer.transparency')}
                  </Link>
                </p>
              </div>
            </div>
          </Tabs.Content>

          {/* Magasin Tab – magasins adaptés à la catégorie de l'espèce */}
          <Tabs.Content value="magasin" className="space-y-6 min-w-0 overflow-x-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.shop')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t('store.forSpecies')}
                {species.profile?.category && (
                  <span className="ml-1 font-medium capitalize">({species.profile.category})</span>
                )}
              </p>
              <MagasinTabContent category={species.profile?.category} />
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t('store.disclaimer')}
                </p>
                <Link href="/transparency" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-2 inline-block">
                  {t('footer.transparency')}
                </Link>
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
