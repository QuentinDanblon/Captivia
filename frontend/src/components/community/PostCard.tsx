'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Flag, Heart, MessageCircle, PawPrint } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge, Figure, cx, type FigureRatio } from '@/components/ui';
import {
  communityApi,
  communityErrorKey,
  isAllowedMediaUrl,
  photoAlt,
  type CommunityErrorKey,
  type CommunityPost,
} from '@/lib/community';
import { communityPostPath, communityProfilePath } from '@/lib/platform';
import { CommunityAvatar, PlainText, PostTime } from './primitives';

/** Photos d'une publication (1 à 4) : grille à ratio fixe, photos de l'utilisateur sans crédit. */
export function PhotoGrid({ post, large = false }: { post: CommunityPost; large?: boolean }) {
  const t = useTranslations('community');
  const media = post.media.slice(0, 4);
  if (media.length === 0) return null;
  const labels = {
    photoOf: (n: number, total: number) => t('photo.position', { n, total }),
    byAuthor: (handle: string) => t('photo.byAuthor', { handle }),
    fallback: t('photo.fallback'),
  };
  const ratioFor = (index: number): FigureRatio => {
    if (media.length === 1) return large ? '4/3' : '3/2';
    if (media.length === 3 && index === 0) return '16/9';
    return media.length === 2 ? '3/4' : '4/3';
  };
  return (
    <div className={cx('grid gap-1', media.length > 1 && 'grid-cols-2')}>
      {media.map((m, index) => {
        const alt = photoAlt(post, index, media.length, labels);
        const span = media.length === 1 || (media.length === 3 && index === 0) ? 'col-span-2' : undefined;
        return isAllowedMediaUrl(m.url) ? (
          <Figure
            key={m.id}
            userPhoto
            src={m.url}
            alt={alt}
            ratio={ratioFor(index)}
            fallbackKind="other"
            className={span}
            sizes={large ? '(min-width: 1024px) 720px, 100vw' : '(min-width: 1024px) 560px, 100vw'}
          />
        ) : (
          <Figure key={m.id} alt={alt} ratio={ratioFor(index)} fallbackKind="other" className={span} />
        );
      })}
    </div>
  );
}

/** « J'aime » : bascule immédiate (rétablie si l'API refuse), compteur en mono, `aria-pressed`. */
export function LikeButton({
  post,
  token,
  onError,
}: {
  post: CommunityPost;
  token: string;
  onError?: (key: CommunityErrorKey) => void;
}) {
  const t = useTranslations('community');
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likeCount);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(0);

  const toggle = async () => {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) setPulse((n) => n + 1);
    try {
      const res = next ? await communityApi.like(token, post.id) : await communityApi.unlike(token, post.id);
      setCount(res.likeCount);
    } catch (err) {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      onError?.(communityErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={t('card.likeLabel', { count })}
      className={cx(
        'relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-ui transition-colors hover:bg-sunken',
        liked ? 'text-danger' : 'text-ink-2 hover:text-ink',
      )}
    >
      <Heart
        key={pulse}
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        fill={liked ? 'currentColor' : 'none'}
        className={pulse > 0 && liked ? 'motion-safe:animate-[cv-pop_180ms_var(--ease)]' : undefined}
      />
      <span className="font-mono" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}

export interface PostCardProps {
  post: CommunityPost;
  token: string;
  /** Détail : texte complet, pas de lien vers soi-même, photos plus grandes. */
  variant?: 'feed' | 'detail';
  /** 1 sur la page de détail (la publication est le sujet de la page). */
  headingLevel?: 1 | 2 | 3;
  onReport?: (post: CommunityPost) => void;
  onError?: (key: CommunityErrorKey) => void;
  /** Lecture seule (invité) : pas de « j'aime » cliquable. */
  readOnly?: boolean;
}

/**
 * Publication : auteur (avatar, pseudo, date), photos, texte brut, animal montré (nom et espèce,
 * rien d'autre), « j'aime », réponses, signalement. Surface + filet + rayon 10, comme `MediaCard` ;
 * en fil, toute la carte ouvre le détail (lien étendu), les actions restent cliquables au-dessus.
 */
export default function PostCard({ post, token, variant = 'feed', headingLevel = 2, onReport, onError, readOnly = false }: PostCardProps) {
  const t = useTranslations('community');
  const feed = variant === 'feed';
  const Heading = `h${headingLevel}` as const;
  const handle = post.author.handle;
  const hidden = post.status !== 'VISIBLE';
  const isQuestion = post.type === 'QUESTION';
  const answered = isQuestion && post.helpfulCommentId !== null;

  return (
    <article
      className={cx(
        'relative flex min-w-0 flex-col overflow-hidden rounded-card border bg-surface text-ink',
        hidden ? 'border-dashed border-line-strong' : 'border-line',
        feed && 'transition-colors duration-150 hover:border-line-field focus-within:border-line-field',
      )}
      aria-labelledby={`post-${post.id}-title`}
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <CommunityAvatar url={post.author.avatarUrl} size={36} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Heading id={`post-${post.id}-title`} className="m-0 truncate font-sans text-ui font-semibold text-ink">
            {handle ? (
              <Link href={communityProfilePath(handle)} className="relative z-10 text-ink no-underline hover:text-accent-text hover:underline">
                @{handle}
              </Link>
            ) : (
              t('card.formerMember')
            )}
            <span className="sr-only">
              {' · '}
              {isQuestion ? t('type.QUESTION') : t('type.PHOTO')}
            </span>
          </Heading>
          {feed ? (
            <Link href={communityPostPath(post.id)} className="text-ink-2 no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink">
              <PostTime iso={post.createdAt} />
              <span className="sr-only"> · {t('card.open')}</span>
            </Link>
          ) : (
            <PostTime iso={post.createdAt} />
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {isQuestion ? <Badge tone="info">{t('type.QUESTION')}</Badge> : null}
          {post.speciesCategory ? <Badge>{t(`categories.${post.speciesCategory}`)}</Badge> : null}
          {hidden ? (
            <Badge tone="warn" dot>
              {t('card.hidden')}
            </Badge>
          ) : null}
        </div>
      </header>

      {post.media.length > 0 ? <PhotoGrid post={post} large={!feed} /> : null}

      <div className="grid gap-3 px-4 pt-3 pb-4">
        {post.body ? (
          <PlainText
            text={post.body}
            clamp={feed}
            className={cx(isQuestion ? 'font-display text-h4 leading-snug text-ink' : 'text-body text-ink')}
          />
        ) : null}
        {post.animal ? (
          <p className="m-0 flex items-center gap-2 text-ui text-ink-2">
            <PawPrint size={16} strokeWidth={1.5} aria-hidden="true" className="text-ink-3" />
            <span>
              <span className="font-medium text-ink">{post.animal.name}</span>
              {' · '}
              {post.animal.species}{' '}
              <i lang="la" className="latin">
                {post.animal.scientificName}
              </i>
            </span>
          </p>
        ) : null}
      </div>

      <footer className="relative mt-auto flex flex-wrap items-center gap-1 border-t border-line px-2 py-1">
        {readOnly ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 px-2 text-ui text-ink-2">
            <Heart size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="font-mono">{post.likeCount}</span>
            <span className="sr-only">{t('card.likeLabel', { count: post.likeCount })}</span>
          </span>
        ) : (
          <LikeButton key={`${post.id}-${post.likedByMe}`} post={post} token={token} onError={onError} />
        )}
        {feed ? (
          <Link
            href={communityPostPath(post.id)}
            className="relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-ui text-ink-2 no-underline transition-colors hover:bg-sunken hover:text-ink"
            aria-label={t('card.repliesLabel', { count: post.commentCount })}
          >
            <MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="font-mono" aria-hidden="true">
              {post.commentCount}
            </span>
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-1.5 px-2 text-ui text-ink-2">
            <MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="font-mono" aria-hidden="true">
              {post.commentCount}
            </span>
            <span className="sr-only">{t('card.repliesLabel', { count: post.commentCount })}</span>
          </span>
        )}
        {answered ? (
          <Badge tone="ok" dot className="ml-1">
            {t('card.answered')}
          </Badge>
        ) : null}
        <span className="flex-1" />
        {!post.isMine && onReport ? (
          <button
            type="button"
            onClick={() => onReport(post)}
            className="relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-ui text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            aria-label={t('card.report')}
          >
            <Flag size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className={feed ? 'sr-only sm:not-sr-only' : undefined}>{t('card.reportShort')}</span>
          </button>
        ) : null}
      </footer>
    </article>
  );
}

/** Gabarit de chargement d'une carte du fil (forme du contenu attendu). */
export function PostCardSkeleton({ withPhoto = true }: { withPhoto?: boolean }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="block size-9 rounded-full bg-sunken motion-safe:animate-pulse" />
        <span className="grid flex-1 gap-1.5">
          <span className="block h-3 w-28 rounded-[3px] bg-sunken motion-safe:animate-pulse" />
          <span className="block h-2.5 w-16 rounded-[3px] bg-sunken motion-safe:animate-pulse" />
        </span>
      </div>
      {withPhoto ? <span className="block aspect-[3/2] w-full bg-sunken motion-safe:animate-pulse" /> : null}
      <div className="grid gap-2 px-4 py-4">
        <span className="block h-3 w-full rounded-[3px] bg-sunken motion-safe:animate-pulse" />
        <span className="block h-3 w-3/5 rounded-[3px] bg-sunken motion-safe:animate-pulse" />
      </div>
      <div className="h-12 border-t border-line" />
    </div>
  );
}
