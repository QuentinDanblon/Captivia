'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { AnimalSilhouette, Button, EmptyState, SectionHeader, Skeleton, SkeletonGroup, Toast, buttonClasses } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, useCommunity } from '@/components/community/CommunityGate';
import PostCard, { PostCardSkeleton } from '@/components/community/PostCard';
import ReportModal, { type ReportTarget } from '@/components/community/ReportModal';
import { LoadMore, useCursorList } from '@/components/community/useCursorList';
import { BackLink, CommunityAvatar, ConfirmModal } from '@/components/community/primitives';
import {
  communityApi,
  communityErrorKey,
  formatLongDate,
  type CommunityErrorKey,
  type CommunityPost,
  type PublicProfile,
} from '@/lib/community';

function MemberView({ handle }: { handle: string }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const router = useRouter();
  const { token, isGuest } = useCommunity();
  const [profile, setProfile] = useState<{ handle: string; data: PublicProfile | null; error: CommunityErrorKey | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [toast, setToast] = useState<CommunityErrorKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    communityApi
      .publicProfile(token, handle)
      .then((data) => !cancelled && setProfile({ handle, data, error: null }))
      .catch((err: unknown) => !cancelled && setProfile({ handle, data: null, error: communityErrorKey(err) }));
    return () => {
      cancelled = true;
    };
  }, [token, handle, attempt]);

  const ready = profile?.handle === handle && profile.data !== null;
  const fetchPage = useCallback((cursor: string | null) => communityApi.userPosts(token, handle, cursor), [token, handle]);
  const list = useCursorList<CommunityPost>(ready ? handle : null, fetchPage);

  if (!profile || profile.handle !== handle) {
    return (
      <SkeletonGroup label={t('member.loading')} className="grid gap-4">
        <div className="flex items-center gap-4">
          <Skeleton shape="circle" width={72} />
          <Skeleton width="30%" height={32} />
        </div>
        <PostCardSkeleton />
      </SkeletonGroup>
    );
  }
  if (profile.error === 'notFound') {
    return (
      <EmptyState
        size="page"
        headingLevel={1}
        illustration={<AnimalSilhouette kind="other" size={72} />}
        title={t('member.notFoundTitle')}
        benefit={t('member.notFoundBody')}
        action={
          <Link href="/communaute" className={buttonClasses({ variant: 'secondary' })}>
            {t('post.backToFeed')}
          </Link>
        }
      />
    );
  }
  if (profile.error || !profile.data) {
    return <CommunityNotice errorKey={profile.error ?? 'generic'} severity="urgent" onRetry={() => setAttempt((n) => n + 1)} />;
  }
  const member = profile.data;

  const block = async () => {
    setBlockBusy(true);
    setBlockError(null);
    try {
      await communityApi.block(token, member.handle);
      router.replace('/communaute/blocages');
    } catch (err) {
      setBlockError(t(`errors.${communityErrorKey(err)}.title`));
      setBlockBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-5">
        <CommunityAvatar url={member.avatarUrl} size={72} />
        <SectionHeader
          className="min-w-0 flex-1"
          title={`@${member.handle}`}
          marginNote={t('member.posts', { count: member.postCount })}
          marginLabel={t('member.postsLabel')}
          description={t('member.since', { date: formatLongDate(member.memberSince, locale) })}
          actions={
            member.isMe ? (
              <Link href="/communaute/profil" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {t('member.edit')}
              </Link>
            ) : (
              <Button variant="quiet" size="sm" onClick={() => setBlocking(true)}>
                {t('blocks.block')}
              </Button>
            )
          }
        />
      </div>

      {list.loading ? (
        <SkeletonGroup label={t('feed.loading')} className="grid gap-4">
          <PostCardSkeleton />
        </SkeletonGroup>
      ) : list.error ? (
        <CommunityNotice errorKey={list.error} severity="urgent" onRetry={list.retry} />
      ) : list.items.length === 0 ? (
        <EmptyState headingLevel={2} title={member.isMe ? t('member.emptyMineTitle') : t('member.emptyTitle')} benefit={member.isMe ? t('member.emptyMineBody') : t('member.emptyBody')} action={member.isMe ? <Link href="/communaute/nouvelle" className={buttonClasses({ size: 'sm' })}>{t('feed.emptyAction')}</Link> : undefined} />
      ) : (
        <>
          <ul className="m-0 grid list-none gap-4 p-0" aria-label={t('member.listLabel', { handle: member.handle })}>
            {list.items.map((post) => (
              <li key={post.id}>
                <PostCard post={post} token={token} readOnly={isGuest} onReport={(p) => setReport({ kind: 'post', id: p.id })} onError={setToast} />
              </li>
            ))}
          </ul>
          <LoadMore count={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} error={list.moreError} onLoadMore={list.loadMore} />
        </>
      )}

      <ReportModal target={report} token={token} onClose={() => setReport(null)} />
      <ConfirmModal
        open={blocking}
        title={t('blocks.confirmTitle', { handle: member.handle })}
        message={t('blocks.confirmBody')}
        confirmLabel={t('blocks.block')}
        busy={blockBusy}
        error={blockError}
        onConfirm={block}
        onCancel={() => setBlocking(false)}
      />
      {toast ? <Toast type="error" message={t(`errors.${toast}.title`)} duration={4000} onClose={() => setToast(null)} /> : null}
    </>
  );
}

/** Profil public d'un membre : pseudo, avatar, ancienneté, publications (jamais l'e-mail). */
export default function CommunityMemberPage({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { handle } = use(params);
  const t = useTranslations('community');
  let decoded = handle;
  try {
    decoded = decodeURIComponent(handle);
  } catch {
    // pseudo mal encodé : utilisé tel quel (l'API répondra 404)
  }
  return (
    <CommunityGate>
      <CommunityPage narrow>
        <BackLink href="/communaute">{t('post.backToFeed')}</BackLink>
        <MemberView handle={decoded} />
      </CommunityPage>
    </CommunityGate>
  );
}
