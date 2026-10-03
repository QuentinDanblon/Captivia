'use client';

import { useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type SearchSpeciesFilters } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { speciesPath } from '@/lib/platform';
import { Button, cx } from '@/components/ui';

/** Groupes proposés en raccourci (classes GBIF). */
const GROUPS = ['Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Insecta'];

const PAGE_SIZE = 24;
const SUGGEST_DELAY_MS = 300;

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

const normalize = (results: unknown[] | undefined) => (results ?? []).filter(isSpeciesSearchResult);
const displayName = (s: SpeciesSearchResult) => s.vernacularNames?.[0] || s.canonicalName || s.scientificName;

/**
 * Recherche de fiches espèces (fonction réelle de l'API) : champ libellé, suggestions pendant la
 * saisie, raccourcis par groupe, résultats paginés. Secondaire sur la landing : elle se place
 * après l'offre, pour qui veut lire une fiche avant de créer son carnet.
 */
export function SpeciesSearch() {
  const t = useTranslations();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [results, setResults] = useState<SpeciesSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  /** Requête des résultats affichés (« Voir plus » la reprend, même si le champ a changé). */
  const [searchedQuery, setSearchedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SpeciesSearchResult[] | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupLabel = (value?: string) => {
    if (!value) return '';
    const key = `home.taxonomy.${value}`;
    return t.has(key) ? t(key) : value;
  };

  /**
   * La requête est passée en paramètre : un clic sur un groupe vide le champ et doit chercher
   * sans l'ancienne requête (l'état `query` n'est pas encore à jour dans ce rendu).
   */
  const runSearch = async (nextOffset: number, nextGroup: string | null = group, nextQuery: string = query) => {
    setSuggestions(null);
    setLoading(true);
    setError(null);
    try {
      const filters: SearchSpeciesFilters = nextGroup ? { class: nextGroup } : {};
      const data = await api.searchSpecies(nextQuery.trim(), PAGE_SIZE, nextOffset, filters);
      const found = normalize(data.results);
      setResults((prev) => (nextOffset === 0 ? found : [...prev, ...found]));
      setTotal(data.total ?? found.length);
      setOffset(nextOffset);
      setSearchedQuery(nextQuery);
    } catch {
      setResults([]);
      setTotal(0);
      setError(t('landing.search.unavailable'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() && !group) return;
    await runSearch(0);
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length <= 2) {
      setSuggestions(null);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const data = await api.searchSpecies(value, 8, 0);
        setSuggestions(normalize(data.results));
      } catch {
        setSuggestions([]);
      }
    }, SUGGEST_DELAY_MS);
  };

  const onGroup = async (value: string) => {
    const next = group === value ? null : value;
    setGroup(next);
    if (next) {
      setQuery('');
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      await runSearch(0, next, '');
    } else {
      setResults([]);
      setTotal(0);
      setOffset(0);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit} role="search" className="relative grid gap-2">
        <label htmlFor={inputId} className="text-ui font-medium text-ink">
          {t('landing.search.label')}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={onChange}
            placeholder={t('landing.search.placeholder')}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <Button type="submit">{t('landing.search.submit')}</Button>
        </div>
        {suggestions !== null && query.trim().length > 2 ? (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card border border-line-strong bg-surface shadow-overlay">
            {suggestions.length === 0 ? (
              <p className="m-0 px-4 py-3 text-ui text-ink-2">{t('home.noResults')}</p>
            ) : (
              <ul aria-label={t('landing.search.suggestions')} className="m-0 list-none p-1">
                {suggestions.map((s) => (
                  <li key={s.key}>
                    <Link
                      href={speciesPath(s.key)}
                      onClick={() => setSuggestions(null)}
                      className="flex items-baseline justify-between gap-3 rounded-control px-3 py-2 text-ink no-underline hover:bg-sunken"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{displayName(s)}</span>
                        <i lang="la" className="latin block truncate text-ui text-ink-2">
                          {s.scientificName}
                        </i>
                      </span>
                      {s.class ? <span className="shrink-0 text-meta text-ink-2">{groupLabel(s.class)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </form>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-ui font-medium text-ink">{t('landing.search.browse')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {GROUPS.map((value) => {
            const selected = group === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => onGroup(value)}
                className={cx(
                  'min-h-11 rounded-control border px-3 py-2 text-ui transition-colors',
                  selected ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-field bg-surface text-ink hover:bg-sunken',
                )}
              >
                {groupLabel(value)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="grid gap-4">
        {loading && results.length === 0 ? <p className="m-0 text-ui text-ink-2">{t('common.loading')}</p> : null}
        {error && !loading ? (
          <p role="alert" className="m-0 rounded-control bg-danger-soft px-4 py-3 text-ui text-ink shadow-[inset_3px_0_0_var(--danger)]">
            {error}
          </p>
        ) : null}
        {results.length > 0 ? (
          <section aria-labelledby={`${inputId}-results`} className="grid gap-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
              <h3 id={`${inputId}-results`} className="m-0 text-h4">
                {t('landing.search.resultsTitle')}
              </h3>
              <span className="font-mono text-meta text-ink-2">{t('landing.search.results', { count: total || results.length })}</span>
            </div>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((s) => (
                <li key={s.key}>
                  <Link
                    href={speciesPath(s.key)}
                    data-testid="species-result"
                    className="grid h-full gap-1 rounded-card border border-line bg-surface p-4 text-ink no-underline transition-colors hover:border-line-field"
                  >
                    <span className="font-display text-h4 font-semibold">{displayName(s)}</span>
                    <span className="text-ui text-ink-2">
                      <i lang="la" className="latin">
                        {s.scientificName}
                      </i>
                    </span>
                    {s.class || s.order || s.family ? (
                      <span className="font-mono text-meta text-ink-2">
                        {[groupLabel(s.class), s.order, s.family].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            {results.length < total ? (
              <div>
                <Button variant="secondary" loading={loading} onClick={() => runSearch(offset + PAGE_SIZE, group, searchedQuery)}>
                  {t('common.loadMore')}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
