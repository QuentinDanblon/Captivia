'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { communityErrorKey, type CommunityErrorKey, type Page } from '@/lib/community';

interface ListState<T> {
  key: string;
  items: T[];
  cursor: string | null;
  error: CommunityErrorKey | null;
  /** Erreur brute de la première page (statut 404 d'un profil…). */
  raw: unknown;
}

/**
 * Liste paginée par curseur (fil, publications d'un membre, journal) : première page à chaque
 * changement de `key` (filtres), suite par `loadMore()`. Les éléments déjà affichés restent en
 * place pendant le chargement de la suite.
 */
export function useCursorList<T extends { id: string }>(key: string | null, fetchPage: (cursor: string | null) => Promise<Page<T>>) {
  const [state, setState] = useState<ListState<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<CommunityErrorKey | null>(null);
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetchRef
      .current(null)
      .then((page) => {
        if (!cancelled) setState({ key, items: page.items, cursor: page.nextCursor, error: null, raw: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key, items: [], cursor: null, error: communityErrorKey(err), raw: err });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const current = state && state.key === key ? state : null;

  const loadMore = useCallback(async () => {
    if (!current?.cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchRef.current(current.cursor);
      setState((prev) =>
        prev && prev.key === current.key
          ? {
              ...prev,
              // Dédoublonnage : une publication peut glisser d'une page à l'autre.
              items: [...prev.items, ...page.items.filter((item) => !prev.items.some((p) => p.id === item.id))],
              cursor: page.nextCursor,
            }
          : prev,
      );
    } catch (err) {
      setMoreError(communityErrorKey(err));
    } finally {
      setLoadingMore(false);
    }
  }, [current, loadingMore]);

  const update = useCallback((fn: (items: T[]) => T[]) => {
    setState((prev) => (prev ? { ...prev, items: fn(prev.items) } : prev));
  }, []);

  return {
    loading: key !== null && current === null,
    items: current?.items ?? [],
    hasMore: Boolean(current?.cursor),
    error: current?.error ?? null,
    rawError: current?.raw ?? null,
    loadingMore,
    moreError,
    loadMore,
    retry: () => {
      setState(null);
      setAttempt((n) => n + 1);
    },
    update,
  };
}

const AUTOLOAD_KEY = 'captivia.community.autoload';

function readAutoload(): boolean {
  try {
    return localStorage.getItem(AUTOLOAD_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Pagination accessible : bouton « Voir plus » toujours présent, chargement automatique en
 * option (interrupteur mémorisé), annonce du nombre d'éléments affichés.
 */
export function LoadMore({
  count,
  hasMore,
  loading,
  error,
  onLoadMore,
  allowAuto = true,
}: {
  count: number;
  hasMore: boolean;
  loading: boolean;
  error: CommunityErrorKey | null;
  onLoadMore: () => void;
  allowAuto?: boolean;
}) {
  const t = useTranslations('community');
  const switchId = useId();
  const [auto, setAuto] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    // Préférence lue après l'hydratation (le rendu serveur ne connaît pas localStorage).
    const stored = readAutoload();
    if (stored) {
      const id = window.setTimeout(() => setAuto(true), 0);
      return () => window.clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    if (!auto || !hasMore || loading || error || !sentinel.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [auto, hasMore, loading, error]);

  const toggleAuto = (value: boolean) => {
    setAuto(value);
    try {
      localStorage.setItem(AUTOLOAD_KEY, value ? '1' : '0');
    } catch {
      // préférence non mémorisée
    }
  };

  return (
    <div className="grid justify-items-center gap-3 pt-2">
      <p className="sr-only" role="status" aria-live="polite">
        {t('list.shown', { count })}
      </p>
      {error ? (
        <p role="alert" className="m-0 text-ui font-medium text-danger">
          {t(`errors.${error}.title`)}
        </p>
      ) : null}
      {hasMore ? (
        <>
          <div ref={sentinel} aria-hidden="true" />
          <Button variant="secondary" onClick={onLoadMore} loading={loading}>
            {t('list.more')}
          </Button>
          {allowAuto ? (
            <label htmlFor={switchId} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-meta text-ink-2">
              <input id={switchId} type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} />
              {t('list.auto')}
            </label>
          ) : null}
        </>
      ) : count > 0 ? (
        <p className="m-0 font-mono text-meta text-ink-2">{t('list.end')}</p>
      ) : null}
    </div>
  );
}
