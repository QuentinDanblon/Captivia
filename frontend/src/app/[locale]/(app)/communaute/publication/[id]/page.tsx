'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Alert, AnimalSilhouette, Button, Card, EmptyState, Skeleton, SkeletonGroup, SkeletonText, Toast, buttonClasses } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, EligibilityNotice, useCommunity } from '@/components/community/CommunityGate';
import PostCard from '@/components/community/PostCard';
import { CommentForm, CommentItem, type CommentActions } from '@/components/community/Comments';
import ReportModal, { type ReportTarget } from '@/components/community/ReportModal';
import { BackLink, ConfirmModal } from '@/components/community/primitives';
import {
  communityApi,
  communityErrorKey,
  type CommunityComment,
  type CommunityErrorKey,
  type PostDetail,
} from '@/lib/community';

type Confirm = { kind: 'post' } | { kind: 'comment'; comment: CommunityComment } | { kind: 'block'; handle: string };

function mapComments(items: CommunityComment[], fn: (c: CommunityComment) => CommunityComment | null): CommunityComment[] {
  return items
    .map((c) => fn(c))
    .filter((c): c is CommunityComment => c !== null)
    .map((c) => ({ ...c, replies: c.replies ? mapComments(c.replies, fn) : c.replies }));
}

function DetailSkeleton() {
  const t = useTranslations('community');
  return (
    <SkeletonGroup label={t('post.loading')} className="grid gap-4">
      <Skeleton shape="block" height={360} />
      <SkeletonText lines={3} />
      <Skeleton shape="block" height={140} />
    </SkeletonGroup>
  );
}

function PostView({ id }: { id: string }) {
  const t = useTranslations('community');
  const router = useRouter();
  const { token, isGuest, me } = useCommunity();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [state, setState] = useState<{ id: string; error: CommunityErrorKey | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [helpfulBusy, setHelpfulBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      // Route à query de l'app sans identifiant : rien à charger.
      Promise.resolve().then(() => !cancelled && setState({ id, error: 'notFound' }));
      return () => {
        cancelled = true;
      };
    }
    communityApi
      .post(token, id)
      .then((data) => {
        if (cancelled) return;
        setPost(data);
        setComments(data.comments.items);
        setNextCursor(data.comments.nextCursor);
        setState({ id, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ id, error: communityErrorKey(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [token, id, attempt]);

  const helpfulId = post?.helpfulCommentId ?? null;

  const loadMoreComments = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await communityApi.comments(token, id, nextCursor);
      setComments((prev) => [...prev, ...page.items.filter((c) => !prev.some((p) => p.id === c.id))]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setToast({ type: 'error', message: t(`errors.${communityErrorKey(err)}.title`) });
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, token, id, t]);

  if (!state || state.id !== id) return <DetailSkeleton />;
  if (state.error === 'notFound') {
    return (
      <EmptyState
        size="page"
        headingLevel={1}
        illustration={<AnimalSilhouette kind="other" size={72} />}
        title={t('post.notFoundTitle')}
        benefit={t('post.notFoundBody')}
        action={
          <Link href="/communaute" className={buttonClasses({ variant: 'secondary' })}>
            {t('post.backToFeed')}
          </Link>
        }
      />
    );
  }
  if (state.error || !post) {
    return <CommunityNotice errorKey={state.error ?? 'generic'} severity="urgent" onRetry={() => setAttempt((n) => n + 1)} token={token} />;
  }

  const isQuestion = post.type === 'QUESTION';
  const canWrite = !isGuest && me.canPublish && post.status === 'VISIBLE';

  const actions: CommentActions = {
    canReply: canWrite,
    canMarkHelpful: post.isMine && isQuestion && !isGuest,
    helpfulBusy,
    onReport: (comment) => setReport({ kind: 'comment', id: comment.id }),
    onDelete: (comment) => setConfirm({ kind: 'comment', comment }),
    onReplyCreated: (parentId, reply) => {
      setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c)));
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
    },
    onToggleHelpful: async (comment) => {
      setHelpfulBusy(comment.id);
      try {
        const res = comment.isHelpful ? await communityApi.unmarkHelpful(token, comment.id) : await communityApi.markHelpful(token, comment.id);
        setComments((prev) => mapComments(prev, (c) => ({ ...c, isHelpful: c.id === res.helpfulCommentId })));
        setPost((p) => (p ? { ...p, helpfulCommentId: res.helpfulCommentId } : p));
      } catch (err) {
        setToast({ type: 'error', message: t(`errors.${communityErrorKey(err)}.title`) });
      } finally {
        setHelpfulBusy(null);
      }
    },
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (confirm.kind === 'post') {
        await communityApi.deletePost(token, post.id);
        router.replace('/communaute');
        return;
      }
      if (confirm.kind === 'comment') {
        await communityApi.deleteComment(token, confirm.comment.id);
        const removed = confirm.comment;
        setComments((prev) => mapComments(prev, (c) => (c.id === removed.id ? null : c)));
        setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1 - (removed.replies?.length ?? 0)) } : p));
        setToast({ type: 'success', message: t('comments.deleted') });
      } else {
        await communityApi.block(token, confirm.handle);
        router.replace('/communaute');
        return;
      }
      setConfirm(null);
    } catch (err) {
      setConfirmError(t(`errors.${communityErrorKey(err)}.title`));
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmCopy =
    confirm?.kind === 'post'
      ? { title: t('post.deleteTitle'), message: t('post.deleteBody'), label: t('post.delete'), tone: 'danger' as const }
      : confirm?.kind === 'comment'
        ? { title: t('comments.deleteTitle'), message: t('comments.deleteBody'), label: t('comments.delete'), tone: 'danger' as const }
        : confirm?.kind === 'block'
          ? { title: t('blocks.confirmTitle', { handle: confirm.handle }), message: t('blocks.confirmBody'), label: t('blocks.block'), tone: 'danger' as const }
          : null;

  return (
    <>
      {post.status !== 'VISIBLE' ? (
        <Alert severity="warning" title={t('post.hiddenTitle')} action={<Link href="/communaute/decisions" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>{t('actions.seeDecision')}</Link>}>
          {t('post.hiddenBody')}
        </Alert>
      ) : null}

      <PostCard
        post={post}
        token={token}
        variant="detail"
        headingLevel={1}
        readOnly={isGuest}
        onReport={(p) => setReport({ kind: 'post', id: p.id })}
        onError={(key) => setToast({ type: 'error', message: t(`errors.${key}.title`) })}
      />

      <div className="-mt-2 flex flex-wrap gap-2">
        {post.isMine ? (
          <Button variant="quiet" size="sm" onClick={() => setConfirm({ kind: 'post' })}>
            {t('post.delete')}
          </Button>
        ) : post.author.handle ? (
          <Button variant="quiet" size="sm" onClick={() => setConfirm({ kind: 'block', handle: post.author.handle as string })}>
            {t('blocks.blockHandle', { handle: post.author.handle })}
          </Button>
        ) : null}
      </div>

      <Card
        as="section"
        title={isQuestion ? t('comments.answersTitle', { count: post.commentCount }) : t('comments.title', { count: post.commentCount })}
        titleId="reponses"
        headingLevel={2}
      >
        {isQuestion && post.isMine && !helpfulId && comments.length > 0 ? (
          <p className="m-0 mb-2 text-ui text-ink-2">{t('comments.helpfulHint')}</p>
        ) : null}
        {comments.length === 0 ? (
          <p className="m-0 py-2 text-body text-ink-2">{isQuestion ? t('comments.emptyQuestion') : t('comments.empty')}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-line p-0">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} token={token} actions={actions} />
            ))}
          </ul>
        )}
        {nextCursor ? (
          <div className="pt-2">
            <Button variant="secondary" size="sm" onClick={loadMoreComments} loading={loadingMore}>
              {t('comments.more')}
            </Button>
          </div>
        ) : null}

        <div className="mt-4 border-t border-line pt-4">
          {canWrite ? (
            <CommentForm
              token={token}
              postId={post.id}
              label={isQuestion ? t('comments.answerLabel') : t('comments.label')}
              submitLabel={t('comments.send')}
              onCreated={(comment) => {
                setComments((prev) => [...prev, comment]);
                setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
              }}
            />
          ) : post.status === 'VISIBLE' ? (
            <EligibilityNotice />
          ) : null}
        </div>
      </Card>

      <ReportModal target={report} token={token} onClose={() => setReport(null)} />
      {confirmCopy ? (
        <ConfirmModal
          open
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.label}
          tone={confirmCopy.tone}
          busy={confirmBusy}
          error={confirmError}
          onConfirm={runConfirm}
          onCancel={() => {
            setConfirm(null);
            setConfirmError(null);
          }}
        />
      ) : null}
      {toast ? <Toast type={toast.type} message={toast.message} duration={4000} onClose={() => setToast(null)} /> : null}
    </>
  );
}

/** Détail d'une publication : photos, texte, réponses (un niveau), réponse utile, signalement. */
export default function CommunityPostPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('community');
  return (
    <CommunityGate>
      <CommunityPage narrow>
        <BackLink href="/communaute">{t('post.backToFeed')}</BackLink>
        <PostView id={id} />
      </CommunityPage>
    </CommunityGate>
  );
}

