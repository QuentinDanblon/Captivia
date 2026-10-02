'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type SearchSpeciesFilters } from '@/lib/api';
import { ArrowRight, Bird, Bug, CircleDot, Fish, Leaf, Rabbit, Search, Sparkles, Turtle } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const animalTypes = [
  { value: 'Reptilia', icon: Turtle, tone: 'mint' },
  { value: 'Aves', icon: Bird, tone: 'sky' },
  { value: 'Mammalia', icon: Rabbit, tone: 'peach' },
  { value: 'Amphibia', icon: CircleDot, tone: 'lime' },
  { value: 'Actinopterygii', icon: Fish, tone: 'blue' },
  { value: 'Insecta', icon: Bug, tone: 'amber' },
];

interface SpeciesSearchResult {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularNames?: string[];
  class?: string;
  order?: string;
  family?: string;
  rank?: string;
  iucnStatus?: string;
}

function isSpeciesSearchResult(value: unknown): value is SpeciesSearchResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.key === 'number' && typeof candidate.scientificName === 'string';
}

function normalizeSpeciesResults(results: unknown[] | undefined): SpeciesSearchResult[] {
  return (results ?? []).filter(isSpeciesSearchResult);
}

export default function Home() {
  const t = useTranslations();
  const taxonomyLabel = (value?: string): string => {
    if (!value) return '-';
    const key = `home.taxonomy.${value}`;
    return t.has(key) ? t(key) : value;
  };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpeciesSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SpeciesSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsTimeout, setSuggestionsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const PAGE_SIZE = 24;

  const runSearch = async (nextOffset: number, nextFilter: string | null = selectedTypeFilter) => {
    setShowSuggestions(false);
    setLoading(true);
    setSearchError(null);
    try {
      // Requête vide + filtre = parcourir TOUTE la catégorie depuis les profils
      const searchQuery = query.trim() || '';
      const filters: SearchSpeciesFilters = {};
      if (nextFilter) {
        filters.class = nextFilter;
      }

      const data = await api.searchSpecies(searchQuery, PAGE_SIZE, nextOffset, filters);
      const normalized = normalizeSpeciesResults(data.results);
      setResults((prev) =>
        nextOffset === 0 ? normalized : [...prev, ...normalized]
      );
      setTotalResults(data.total ?? normalized.length);
      setOffset(nextOffset);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTotalResults(0);
      setSearchError(
        error instanceof Error
          ? error.message
          : t('home.searchUnavailable')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && !selectedTypeFilter) return;
    await runSearch(0);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (suggestionsTimeout) {
      clearTimeout(suggestionsTimeout);
    }

    if (value.trim().length > 2) {
      setSuggestionsLoading(true);
      setShowSuggestions(true);

      const timeout = setTimeout(async () => {
        try {
          const data = await api.searchSpecies(value, 8, 0);
          setSuggestions(normalizeSpeciesResults(data.results));
          setSuggestionsLoading(false);
        } catch (error) {
          console.error('Suggestions error:', error);
          setSuggestions([]);
          setSuggestionsLoading(false);
        }
      }, 300);

      setSuggestionsTimeout(timeout);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = () => {
    setShowSuggestions(false);
    setSuggestions([]);
    setResults([]);
  };

  const handleTypeFilter = async (classValue: string) => {
    const newFilter = selectedTypeFilter === classValue ? null : classValue;
    setSelectedTypeFilter(newFilter);

    if (newFilter) {
      // Clic sur une catégorie = parcourir TOUTES les fiches de cette catégorie
      setQuery('');
      await runSearch(0, newFilter);
    } else {
      setResults([]);
      setTotalResults(0);
      setOffset(0);
    }
  };

  return (
    <div className="captivia-home">
      <div className="captivia-home-glow captivia-home-glow-one" aria-hidden="true" />
      <div className="captivia-home-glow captivia-home-glow-two" aria-hidden="true" />

      <div className="captivia-container">
        <section className="captivia-hero" aria-labelledby="captivia-hero-title">
          <div className="captivia-hero-copy">
            <div className="captivia-eyebrow">
              <span className="captivia-eyebrow-mark"><Sparkles size={13} strokeWidth={2.6} /></span>
              <span>{t('home.eyebrow')}</span>
            </div>
            <h1 id="captivia-hero-title" className="captivia-hero-title">
              <span className="captivia-title-brand">{t('common.appName')}</span>
              <span className="captivia-title-line">{t('home.heroLine')}</span>
            </h1>
            <p className="captivia-hero-description">{t('home.subtitle')}</p>
            <div className="captivia-hero-signals" aria-label={t('home.pillarsLabel')}>
              <span><i aria-hidden="true" /> {t('home.pillarExplore')}</span>
              <span><i aria-hidden="true" /> {t('home.pillarUnderstand')}</span>
              <span><i aria-hidden="true" /> {t('home.pillarCare')}</span>
            </div>
          </div>

          <div className="captivia-explorer-card">
            <div className="captivia-explorer-topline">
              <div>
                <span className="captivia-card-kicker">{t('home.explorerKicker')}</span>
                <h2>{t('home.explorerTitle')}</h2>
              </div>
              <span className="captivia-explorer-icon" aria-hidden="true"><Search size={21} strokeWidth={2.1} /></span>
            </div>

            <form onSubmit={handleSearch} className="captivia-search-form">
              <div className="captivia-search-field">
                <Search size={20} strokeWidth={2.1} aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder={t('home.searchPlaceholder')}
                  aria-label={t('home.searchPlaceholder')}
                />
              </div>
              <button type="submit" className="captivia-search-button">
                <span>{t('common.search')}</span>
                <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </form>

            <div className="captivia-explorer-footer">
              <span><Leaf size={15} aria-hidden="true" /> {t('home.speciesProfiles')}</span>
              <span>{t('home.instantSearch')}</span>
            </div>

            {showSuggestions && (
              <div className="captivia-suggestions" role="listbox">
                {suggestionsLoading && (
                  <div className="captivia-suggestion-loading">{t('common.loading')}</div>
                )}
                {!suggestionsLoading && suggestions.length === 0 && (
                  <div className="captivia-suggestion-loading">{t('home.noResults')}</div>
                )}
                {!suggestionsLoading && suggestions.map((species) => (
                  <Link
                    key={species.key}
                    href={`/species/${species.key}`}
                    onClick={handleSuggestionClick}
                    className="captivia-suggestion"
                    role="option"
                  >
                    <span className="captivia-suggestion-icon" aria-hidden="true"><Leaf size={16} /></span>
                    <span className="captivia-suggestion-copy">
                      <strong>
                        {species.vernacularNames && species.vernacularNames.length > 0
                          ? species.vernacularNames[0]
                          : species.canonicalName || species.scientificName}
                      </strong>
                      <small>{species.scientificName}</small>
                    </span>
                    {species.class && <span className="captivia-suggestion-tag">{taxonomyLabel(species.class)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="captivia-discovery" aria-labelledby="captivia-discovery-title">
          <div className="captivia-section-heading">
            <div>
              <span className="captivia-card-kicker">{t('home.discoverKicker')}</span>
              <h2 id="captivia-discovery-title">{t('store.filterByCategory')}</h2>
            </div>
            {selectedTypeFilter && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTypeFilter(null);
                  setResults([]);
                }}
                className="captivia-reset-button"
              >
                {t('common.reset')}
              </button>
            )}
          </div>

          <div className="captivia-category-grid">
            {animalTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedTypeFilter === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleTypeFilter(type.value)}
                  aria-pressed={isSelected}
                  className={`captivia-category-card${isSelected ? ' is-selected' : ''}`}
                >
                  <span className={`captivia-category-icon tone-${type.tone}`} aria-hidden="true">
                    <Icon size={29} strokeWidth={1.9} />
                  </span>
                  <span className="captivia-category-label">{taxonomyLabel(type.value)}</span>
                  <span className="captivia-category-arrow" aria-hidden="true"><ArrowRight size={18} strokeWidth={2.2} /></span>
                </button>
              );
            })}
          </div>
        </section>

        {loading && (
          <div className="captivia-status" role="status" aria-live="polite">
            <span className="captivia-spinner" aria-hidden="true" />
            <p>{t('common.loading')}</p>
          </div>
        )}

        {searchError && !loading && (
          <div className="captivia-error" role="alert">
            <p>{searchError}</p>
          </div>
        )}

        {results.length > 0 && (
          <section className="captivia-results" aria-labelledby="captivia-results-title">
            <div className="captivia-results-heading">
              <div>
                <span className="captivia-card-kicker">{t('home.resultsKicker')}</span>
                <h2 id="captivia-results-title">{t('home.resultsTitle')}</h2>
              </div>
              <span className="captivia-results-count">
                {t('home.profileCount', { count: totalResults > 0 ? totalResults : results.length })}
              </span>
            </div>
            <div className="captivia-results-grid">
              {results.map((species) => (
                <Link
                  key={species.key}
                  href={`/species/${species.key}`}
                  className="captivia-result-card"
                  data-testid="species-result"
                >
                  <div className="captivia-result-card-top">
                    <span className="captivia-result-badge"><Leaf size={13} aria-hidden="true" /> {t('home.profileBadge')}</span>
                    <span className="captivia-result-arrow" aria-hidden="true"><ArrowRight size={17} strokeWidth={2.3} /></span>
                  </div>
                  <h3>
                    {species.vernacularNames && species.vernacularNames.length > 0
                      ? species.vernacularNames[0]
                      : species.canonicalName || species.scientificName}
                  </h3>
                  <p className="captivia-result-scientific">{species.scientificName}</p>
                  {(species.class || species.order || species.family) && (
                    <p className="captivia-result-taxonomy">
                      {species.class && <span>{taxonomyLabel(species.class)}</span>}
                      {species.class && species.order && <span> · </span>}
                      {species.order && <span>{species.order}</span>}
                      {(species.class || species.order) && species.family && <span> · </span>}
                      {species.family && <span>{species.family}</span>}
                    </p>
                  )}
                  <div className="captivia-result-tags">
                    <span>{species.rank}</span>
                    {species.iucnStatus && <span className="is-warm">{species.iucnStatus}</span>}
                  </div>
                </Link>
              ))}
            </div>
            {offset + results.length < totalResults && (
              <div className="captivia-results-more">
                <button
                  type="button"
                  onClick={() => runSearch(offset + PAGE_SIZE)}
                  disabled={loading}
                  className="captivia-load-more"
                >
                  {loading ? t('common.loading') : t('common.loadMore')}
                </button>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
