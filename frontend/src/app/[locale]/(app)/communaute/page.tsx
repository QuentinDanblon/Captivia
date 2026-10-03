'use client';

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PenLine } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { AnimalSilhouette, Button, EmptyState, Field, SectionHeader, SkeletonGroup, Toast, buttonClasses, cx } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, EligibilityNotice, useCommunity } from '@/components/community/CommunityGate';
import CommunityAside from '@/components/community/CommunityAside';
import PostCard, { PostCardSkeleton } from '@/components/community/PostCard';
import ReportModal, { type ReportTarget } from '@/components/community/ReportModal';
import { LoadMore, useCursorList } from '@/components/community/useCursorList';
import { feedQuery, parseFeedFilters } from '@/components/community/filters';
import {
  COMMUNITY_CATEGORIES,
  POST_TYPES,
  communityApi,
  type CommunityCategory,
  type CommunityErrorKey,
  type CommunityPost,
  type CommunityPostType,
} from '@/lib/community';

function FeedSkeleton() {
  const t = useTranslations('community');
  return (
    <SkeletonGroup label={t('feed.loading')} className="grid gap-4">
      <PostCardSkeleton />
      <PostCardSkeleton withPhoto={false} />
      <PostCardSkeleton />
    </SkeletonGroup>
  );
}

function Feed() {
  const t = useTranslations('community');
  const { token, isGuest, me } = useCommunity();
  const searchParams = useSearchParams();
  const initial = parseFeedFilters(searchParams);
  const [type, setType] = useState<CommunityPostType | null>(initial.type);
  const [category, setCategory] = useState<CommunityCategory | null>(initial.category);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [toast, setToast] = useState<CommunityErrorKey | null>(null);

  const key = `${type ?? ''}|${category ?? ''}`;
  const fetchPage = useCallback((cursor: string | null) => communityApi.feed(token, { type, category }, cursor), [token, type, category]);
  const list = useCursorList<CommunityPost>(key, fetchPage);

  const applyFilters = (nextType: CommunityPostType | null, nextCategory: CommunityCategory | null) => {
    setType(nextType);
    setCategory(nextCategory);
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${feedQuery(nextType, nextCategory)}`);
    }
  };
  const filtered = type !== null || category !== null;
  const canWrite = !isGuest;

  return (
    <CommunityPage>
      <SectionHeader
        title={t('feed.title')}
        description={t('feed.lead')}
        actions={
          <Link href="/communaute/nouvelle" className={buttonClasses()}>
            <PenLine size={18} aria-hidden="true" />
            {t('feed.publish')}
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-5 lg:col-span-8">
          <EligibilityNotice />

          <div role="group" aria-label={t('feed.filtersLabel')} className="grid gap-4 sm:grid-cols-[auto_minmax(0,16rem)] sm:items-end sm:justify-between">
            <div className="grid gap-1.5">
              <span className="text-ui font-medium text-ink" id="feed-type-label">
                {t('feed.typeLabel')}
              </span>
              <div role="group" aria-labelledby="feed-type-label" className="inline-flex w-fit rounded-control border border-line-field bg-surface p-0.5">
                {[null, ...POST_TYPES].map((value) => {
                  const active = type === value;
                  return (
                    <button
                      key={value ?? 'all'}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyFilters(value, category)}
                      className={cx(
                        'min-h-10 rounded-[4px] px-3 text-ui font-medium transition-colors pointer-coarse:min-h-11',
                        active ? 'bg-accent text-on-accent' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                      )}
                    >
                      {value ? t(`type.plural.${value}`) : t('feed.allTypes')}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label={t('feed.categoryLabel')} id="feed-category">
              <select value={category ?? ''} onChange={(e) => applyFilters(type, (e.target.value || null) as CommunityCategory | null)}>
                <option value="">{t('feed.allCategories')}</option>
                {COMMUNITY_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`categories.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {list.loading ? (
            <FeedSkeleton />
          ) : list.error ? (
            <CommunityNotice errorKey={list.error} severity="urgent" onRetry={list.retry} token={token} />
          ) : list.items.length === 0 ? (
            filtered ? (
              <EmptyState
                headingLevel={2}
                title={t('feed.emptyFilteredTitle')}
                benefit={t('feed.emptyFilteredBody')}
                action={
                  <Button variant="secondary" size="sm" onClick={() => applyFilters(null, null)}>
                    {t('feed.resetFilters')}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                size="page"
                headingLevel={2}
                illustration={<AnimalSilhouette kind="bird" size={72} />}
                title={t('feed.emptyTitle')}
                benefit={t('feed.emptyBody')}
                action={
                  canWrite ? (
                    <Link href="/communaute/nouvelle" className={buttonClasses()}>
                      {me.profile ? t('feed.emptyAction') : t('actions.createProfile')}
                    </Link>
                  ) : undefined
                }
              />
            )
          ) : (
            <>
              <ul className="m-0 grid list-none gap-4 p-0" aria-label={t('feed.listLabel')}>
                {list.items.map((post) => (
                  <li key={post.id}>
                    <PostCard
                      post={post}
                      token={token}
                      readOnly={isGuest}
                      onReport={(p) => setReport({ kind: 'post', id: p.id })}
                      onError={setToast}
                    />
                  </li>
                ))}
              </ul>
              <LoadMore count={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} error={list.moreError} onLoadMore={list.loadMore} />
            </>
          )}
        </div>

        <CommunityAside className="lg:col-span-4" />
      </div>

      <ReportModal target={report} token={token} onClose={() => setReport(null)} />
      {toast ? <Toast type="error" message={t(`errors.${toast}.title`)} duration={4000} onClose={() => setToast(null)} /> : null}
    </CommunityPage>
  );
}

/** Fil de la communauté : publications récentes, filtres par type et par espèce, pagination. */
export default function CommunityFeedPage() {
  return (
    <CommunityGate>
      <Suspense fallback={null}>
        <Feed />
      </Suspense>
    </CommunityGate>
  );
}
