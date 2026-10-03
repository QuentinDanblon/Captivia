'use client';

import { Suspense, useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { api, type SearchSpeciesFilters } from '@/lib/api';
import { SPECIES_GROUPS, normalizeSpeciesResult, speciesGroupById, type SpeciesGroup, type SpeciesSummary } from '@/lib/species';
import { Alert, AnimalSilhouette, Button, EmptyState, SectionHeader, Skeleton, SkeletonGroup, cx } from '@/components/ui';
import { SpeciesCard } from '@/components/species/SpeciesCard';

const PAGE_SIZE = 24;
/** Délai après la dernière frappe avant de lancer la recherche. */
const TYPING_DELAY_MS = 350;
/** En dessous, une saisie ne déclenche rien pendant la frappe (« b » renverrait tout). */
const MIN_QUERY_LENGTH = 2;

interface ResultPage {
  key: string;
  items: SpeciesSummary[];
  total: number;
  error: boolean;
}

async function fetchSpecies(query: string, group: SpeciesGroup | null, offset: number) {
  // Sans texte ni groupe, l'API exige un critère : « tout le règne animal » liste toutes les fiches.
  const filters: SearchSpeciesFilters = group ? { class: group.gbifClass } : query ? {} : { kingdom: 'Animalia' };
  const data = await api.searchSpecies(query, PAGE_SIZE, offset, filters);
  const items = (data.results ?? []).map(normalizeSpeciesResult).filter((s): s is SpeciesSummary => s !== null);
  return { items, total: typeof data.total === 'number' ? data.total : items.length };
}

/** Recherche et filtre reflétés dans l'URL : un retour depuis une fiche retrouve la même liste. */
function writeUrl(query: string, groupId: string | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (query) params.set('q', query);
  else params.delete('q');
  if (groupId) params.set('groupe', groupId);
  else params.delete('groupe');
  const search = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label}>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-card border border-line bg-surface p-3 sm:grid-cols-1 sm:gap-3">
            <Skeleton shape="block" className="size-22 sm:aspect-[3/2] sm:h-auto sm:w-full" />
            <div className="grid content-start gap-2 sm:px-1 sm:pb-1">
              <Skeleton width={`${70 - (i % 3) * 12}%`} height={20} />
              <Skeleton width="45%" />
              <Skeleton width="30%" />
            </div>
          </li>
        ))}
      </ul>
    </SkeletonGroup>
  );
}

function SpeciesSearchView() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const inputId = useId();
  const resultsId = useId();
  const [text, setText] = useState(() => searchParams.get('q') ?? '');
  const [query, setQuery] = useState(() => (searchParams.get('q') ?? '').trim());
  const [groupId, setGroupId] = useState<string | null>(() => speciesGroupById(searchParams.get('groupe'))?.id ?? null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<ResultPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Groupe courant lu par la recherche différée (un filtre choisi pendant la frappe est conservé).
  const groupRef = useRef(groupId);
  useEffect(() => {
    groupRef.current = groupId;
  }, [groupId]);

  const group = speciesGroupById(groupId);
  const requestKey = JSON.stringify([query, groupId, attempt]);

  useEffect(() => {
    let cancelled = false;
    fetchSpecies(query, speciesGroupById(groupId), 0)
      .then(({ items, total }) => {
        if (!cancelled) setPage({ key: requestKey, items, total, error: false });
      })
      .catch(() => {
        if (!cancelled) setPage({ key: requestKey, items: [], total: 0, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, query, groupId]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  const commit = useCallback((nextQuery: string, nextGroupId: string | null) => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setQuery(nextQuery);
    setGroupId(nextGroupId);
    setMoreFailed(false);
    writeUrl(nextQuery, nextGroupId);
  }, []);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setText(value);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH) return;
    typingTimer.current = setTimeout(() => commit(trimmed, groupRef.current), TYPING_DELAY_MS);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    commit(text.trim(), groupId);
  };

  /** Changement de groupe : la saisie en cours (non encore lancée) est prise en compte. */
  const chooseGroup = (nextGroupId: string | null) => {
    const typed = text.trim();
    commit(typed.length === 0 || typed.length >= MIN_QUERY_LENGTH ? typed : query, nextGroupId);
  };

  const clearSearch = () => {
    setText('');
    commit('', groupId);
  };

  const loadMore = async () => {
    if (!page || loadingMore) return;
    const key = page.key;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = await fetchSpecies(query, group, page.items.length);
      setPage((current) =>
        current && current.key === key
          ? { ...current, items: [...current.items, ...next.items.filter((s) => !current.items.some((c) => c.id === s.id))], total: next.total }
          : current,
      );
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const fresh = page !== null && page.key === requestKey;
  const shown = page?.error ? null : page;
  const remaining = shown ? Math.max(0, shown.total - shown.items.length) : 0;
  const groupLabel = group ? t(`speciesSearch.groups.${group.id}`) : null;
  const heading = query ? t('speciesSearch.resultsFor', { query }) : (groupLabel ?? t('speciesSearch.resultsAll'));

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <SectionHeader level={1} title={t('speciesSearch.title')} description={t('speciesSearch.intro')} />

      <div className="grid gap-4">
        <form role="search" onSubmit={onSubmit} className="grid max-w-2xl gap-2">
          <label htmlFor={inputId} className="text-ui font-medium text-ink">
            {t('speciesSearch.label')}
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={18} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
              <input
                id={inputId}
                type="search"
                value={text}
                onChange={onChange}
                placeholder={t('speciesSearch.placeholder')}
                autoComplete="off"
                enterKeyHint="search"
                aria-controls={resultsId}
                className="w-full pl-10"
              />
            </div>
            <Button type="submit">{t('speciesSearch.submit')}</Button>
          </div>
        </form>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0 text-ui font-medium text-ink">{t('speciesSearch.groupsLabel')}</legend>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
            <ul className="m-0 flex w-max list-none gap-2 p-0 sm:w-auto sm:flex-wrap">
              {[null, ...SPECIES_GROUPS].map((g) => {
                const selected = (g?.id ?? null) === groupId;
                return (
                  <li key={g?.id ?? 'all'}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseGroup(g?.id ?? null)}
                      className={cx(
                        'inline-flex min-h-11 items-center gap-2 rounded-control border px-3 text-ui whitespace-nowrap transition-colors',
                        selected
                          ? 'border-accent bg-accent-soft font-medium text-accent-text'
                          : 'border-line-field bg-surface text-ink hover:bg-sunken',
                      )}
                    >
                      {g ? <AnimalSilhouette kind={g.silhouette} size={22} className={selected ? 'text-accent-text' : 'text-ink-3'} /> : null}
                      {t(`speciesSearch.groups.${g?.id ?? 'all'}`)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </fieldset>
      </div>

      <section id={resultsId} aria-labelledby={`${resultsId}-title`} className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
          <h2 id={`${resultsId}-title`} className="m-0 text-h4">
            {heading}
          </h2>
          {shown && fresh ? (
            <p className="m-0 font-mono text-meta text-ink-2" aria-live="polite">
              {t('speciesSearch.count', { count: shown.total })}
            </p>
          ) : null}
        </div>

        {page === null || (!fresh && (page.error || page.items.length === 0)) ? (
          <ResultsSkeleton label={t('speciesSearch.loading')} />
        ) : fresh && page.error ? (
          <Alert
            severity="warning"
            title={t('speciesSearch.errorTitle')}
            action={
              <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                {t('common.retry')}
              </Button>
            }
          >
            {t('speciesSearch.errorBody')}
          </Alert>
        ) : fresh && page.items.length === 0 ? (
          <EmptyState
            title={query ? t('speciesSearch.emptyTitle', { query }) : t('speciesSearch.emptyGroupTitle')}
            benefit={group && query ? t('speciesSearch.emptyGroupBenefit') : t('speciesSearch.emptyBenefit')}
            illustration={<AnimalSilhouette kind={group?.silhouette ?? 'other'} size={56} />}
            action={
              group ? (
                <Button variant="secondary" size="sm" onClick={() => commit(query, null)}>
                  {t('speciesSearch.allGroups')}
                </Button>
              ) : query ? (
                <Button variant="secondary" size="sm" onClick={clearSearch}>
                  {t('speciesSearch.clear')}
                </Button>
              ) : undefined
            }
          />
        ) : shown ? (
          <div className={cx('grid gap-4 transition-opacity', !fresh && 'opacity-60')} aria-busy={!fresh || undefined}>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {shown.items.map((species) => (
                <SpeciesCard key={species.id} species={species} />
              ))}
            </ul>
            {fresh && remaining > 0 ? (
              <div className="grid justify-items-start gap-2">
                <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                  {t('speciesSearch.more', { count: Math.min(PAGE_SIZE, remaining) })}
                </Button>
                {moreFailed ? (
                  <p role="alert" className="m-0 text-ui text-danger">
                    {t('speciesSearch.moreFailed')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/**
 * Recherche d'espèces de l'app (onglet « Espèces ») : champ avec recherche pendant la frappe,
 * filtres par groupe, résultats en cartes illustrées. Sans critère, toutes les fiches sont listées.
 * `useSearchParams` exige une frontière Suspense (export statique de l'app mobile).
 */
function SearchFallback() {
  const t = useTranslations();
  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <SectionHeader level={1} title={t('speciesSearch.title')} description={t('speciesSearch.intro')} />
      <ResultsSkeleton label={t('speciesSearch.loading')} />
    </div>
  );
}

export default function SpeciesSearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SpeciesSearchView />
    </Suspense>
  );
}
