'use client';

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge, Button, cx } from '@/components/ui';
import {
  COMMUNITY_LIMITS,
  communityApi,
  communityErrorKey,
  type CommunityComment,
  type CommunityErrorKey,
} from '@/lib/community';
import { communityProfilePath } from '@/lib/platform';
import { CharCount, CommunityAvatar, PlainText, PostTime } from './primitives';

/** Formulaire de réponse (commentaire racine ou réponse à un commentaire). */
export function CommentForm({
  token,
  postId,
  parentId,
  label,
  submitLabel,
  autoFocus = false,
  onCreated,
  onCancel,
}: {
  token: string;
  postId: string;
  parentId?: string;
  label: string;
  submitLabel: string;
  autoFocus?: boolean;
  onCreated: (comment: CommunityComment) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('community');
  const tc = useTranslations('common');
  const id = useId();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CommunityErrorKey | null>(null);
  const tooLong = body.length > COMMUNITY_LIMITS.commentBody;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setError('bodyRequired');
      return;
    }
    if (tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const created = await communityApi.comment(token, postId, { body: text, ...(parentId ? { parentId } : {}) });
      setBody('');
      onCreated({ ...created, replies: created.replies ?? [] });
    } catch (err) {
      setError(communityErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2" noValidate>
      <label htmlFor={`${id}-body`} className="text-ui font-medium text-ink">
        {label}
      </label>
      <textarea
        id={`${id}-body`}
        rows={parentId ? 2 : 3}
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => {
          setBody(e.target.value);
          if (error === 'bodyRequired') setError(null);
        }}
        aria-invalid={error || tooLong ? true : undefined}
        aria-describedby={`${id}-count${error ? ` ${id}-error` : ''}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CharCount id={`${id}-count`} value={body} max={COMMUNITY_LIMITS.commentBody} />
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <Button variant="quiet" size="sm" onClick={onCancel} disabled={busy}>
              {tc('cancel')}
            </Button>
          ) : null}
          <Button type="submit" size="sm" loading={busy} disabled={tooLong}>
            {submitLabel}
          </Button>
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 text-meta font-medium text-danger">
          {t(`errors.${error}.title`)} {error !== 'bodyRequired' ? t(`errors.${error}.body`) : null}
        </p>
      ) : null}
    </form>
  );
}

export interface CommentActions {
  canReply: boolean;
  /** Auteur de la question : peut marquer la réponse utile. */
  canMarkHelpful: boolean;
  onReport: (comment: CommunityComment) => void;
  onDelete: (comment: CommunityComment) => void;
  onToggleHelpful: (comment: CommunityComment) => void;
  onReplyCreated: (parentId: string, reply: CommunityComment) => void;
  helpfulBusy: string | null;
}

/** Une réponse : auteur, date, texte brut, marque « réponse utile », actions discrètes. */
export function CommentItem({
  comment,
  token,
  actions,
  isReply = false,
}: {
  comment: CommunityComment;
  token: string;
  actions: CommentActions;
  isReply?: boolean;
}) {
  const t = useTranslations('community');
  const [replying, setReplying] = useState(false);
  const handle = comment.author.handle;
  const hidden = comment.status !== 'VISIBLE';

  return (
    <li
      id={`reponse-${comment.id}`}
      className={cx(
        'grid gap-2 py-4',
        comment.isHelpful && 'rounded-control bg-ok-soft px-3 shadow-[inset_3px_0_0_var(--ok)]',
        isReply && 'pl-4',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CommunityAvatar url={comment.author.avatarUrl} size={28} />
        {handle ? (
          <Link href={communityProfilePath(handle)} className="text-ui font-semibold text-ink no-underline hover:text-accent-text hover:underline">
            @{handle}
          </Link>
        ) : (
          <span className="text-ui font-semibold text-ink-2">{t('card.formerMember')}</span>
        )}
        <PostTime iso={comment.createdAt} />
        {comment.isHelpful ? (
          <Badge tone="ok">
            <CheckCircle2 size={14} aria-hidden="true" className="mr-1 inline align-[-2px]" />
            {t('comments.helpful')}
          </Badge>
        ) : null}
        {hidden ? (
          <Badge tone="warn" dot>
            {t('card.hidden')}
          </Badge>
        ) : null}
      </div>
      <PlainText text={comment.body} className="text-body text-ink" />
      <div className="-ml-2 flex flex-wrap items-center gap-1">
        {actions.canReply && !isReply ? (
          <Button variant="quiet" size="sm" onClick={() => setReplying((v) => !v)} aria-expanded={replying}>
            {t('comments.reply')}
          </Button>
        ) : null}
        {actions.canMarkHelpful && !comment.isMine && !hidden ? (
          <Button variant="quiet" size="sm" onClick={() => actions.onToggleHelpful(comment)} loading={actions.helpfulBusy === comment.id} aria-pressed={comment.isHelpful}>
            {comment.isHelpful ? t('comments.unmarkHelpful') : t('comments.markHelpful')}
          </Button>
        ) : null}
        {comment.isMine ? (
          <Button variant="quiet" size="sm" onClick={() => actions.onDelete(comment)}>
            {t('comments.delete')}
          </Button>
        ) : (
          <Button variant="quiet" size="sm" onClick={() => actions.onReport(comment)}>
            {t('comments.report')}
          </Button>
        )}
      </div>
      {replying ? (
        <div className="border-l border-line pl-4">
          <CommentForm
            token={token}
            postId={comment.postId}
            parentId={comment.id}
            label={t('comments.replyTo', { handle: handle ?? '' })}
            submitLabel={t('comments.sendReply')}
            autoFocus
            onCancel={() => setReplying(false)}
            onCreated={(reply) => {
              setReplying(false);
              actions.onReplyCreated(comment.id, reply);
            }}
          />
        </div>
      ) : null}
      {comment.replies && comment.replies.length > 0 ? (
        <ul className="m-0 list-none border-l border-line p-0" aria-label={t('comments.repliesTo', { handle: handle ?? '' })}>
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} token={token} actions={actions} isReply />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
