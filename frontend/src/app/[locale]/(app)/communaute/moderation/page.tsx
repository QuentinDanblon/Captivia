'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import * as Tabs from '@radix-ui/react-tabs';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import {
  COMMUNITY_LIMITS,
  COMMUNITY_REASONS,
  communityErrorKey,
  formatLongDate,
  isAllowedMediaUrl,
  moderationApi,
  type AppealItem,
  type CommunityErrorKey,
  type CommunityReason,
  type LogItem,
  type ModerationContent,
  type QueueItem,
} from '@/lib/community';
import { communityPostPath } from '@/lib/platform';
import { Badge, Button, Card, EmptyState, Field, Modal, SectionHeader, Skeleton, SkeletonGroup, Toast, cx } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, useCommunity } from '@/components/community/CommunityGate';
import { AppealBadge, useDecisionTitle, useReasonLabel } from '@/components/community/Decisions';
import { BackLink, CharCount, PlainText } from '@/components/community/primitives';
import { LoadMore, useCursorList } from '@/components/community/useCursorList';

type ActionKind = 'hide' | 'delete' | 'restore' | 'dismiss' | 'suspend' | 'unsuspend' | 'uphold' | 'reverse';

interface PendingAction {
  kind: ActionKind;
  /** Contenu visé (publication ou commentaire), pseudo (suspension) ou recours. */
  content?: ModerationContent;
  handle?: string;
  appealId?: string;
}

const NEEDS_REASON: ActionKind[] = ['hide', 'delete', 'suspend'];

/**
 * Décision d'opérateur : motif (liste fermée) quand la décision est défavorable, exposé des motifs
 * obligatoire (10 à 2 000 caractères, envoyé à l'auteur), durée pour une suspension.
 */
function ActionModal({ action, token, onClose, onDone }: { action: PendingAction | null; token: string; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations('community');
  const tc = useTranslations('common');
  const id = useId();
  const [reason, setReason] = useState<CommunityReason | ''>('');
  const [statement, setStatement] = useState('');
  const [days, setDays] = useState('7');
  const [errors, setErrors] = useState<{ reason?: string; statement?: string; days?: string; submit?: string }>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setReason('');
    setStatement('');
    setDays('7');
    setErrors({});
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!action) return;
    const next: typeof errors = {};
    const needsReason = NEEDS_REASON.includes(action.kind);
    if (needsReason && !reason) next.reason = t('moderation.form.reasonRequired');
    const text = statement.trim();
    if (text.length < COMMUNITY_LIMITS.statementMin) next.statement = t('moderation.form.statementTooShort', { min: COMMUNITY_LIMITS.statementMin });
    const dayCount = Number.parseInt(days, 10);
    if (action.kind === 'suspend' && (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > COMMUNITY_LIMITS.suspensionMaxDays)) {
      next.days = t('moderation.form.daysRange', { max: COMMUNITY_LIMITS.suspensionMaxDays });
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const c = action.content;
      const kind = c?.targetType === 'COMMENT' ? 'comments' : 'posts';
      switch (action.kind) {
        case 'hide':
          await moderationApi.hide(token, kind, c!.targetId, { reason: reason as CommunityReason, statement: text });
          break;
        case 'delete':
          await moderationApi.remove(token, kind, c!.targetId, { reason: reason as CommunityReason, statement: text });
          break;
        case 'restore':
          await moderationApi.restore(token, kind, c!.targetId, { statement: text });
          break;
        case 'dismiss':
          await moderationApi.dismiss(token, kind, c!.targetId, { statement: text });
          break;
        case 'suspend':
          await moderationApi.suspend(token, action.handle!, { reason: reason as CommunityReason, statement: text, days: dayCount });
          break;
        case 'unsuspend':
          await moderationApi.unsuspend(token, action.handle!, { statement: text });
          break;
        case 'uphold':
        case 'reverse':
          await moderationApi.resolveAppeal(token, action.appealId!, { outcome: action.kind === 'uphold' ? 'UPHELD' : 'REVERSED', statement: text });
          break;
      }
      const done = t(`moderation.done.${action.kind}`);
      reset();
      onDone(done);
    } catch (err) {
      setErrors({ submit: t(`errors.${communityErrorKey(err)}.title`) });
    } finally {
      setBusy(false);
    }
  };

  const destructive = action?.kind === 'delete' || action?.kind === 'suspend' || action?.kind === 'hide';
  return (
    <Modal
      open={action !== null}
      onClose={close}
      title={action ? t(`moderation.actions.${action.kind}.title`, { handle: action.handle ?? action.content?.authorHandle ?? '' }) : ''}
      description={action ? t(`moderation.actions.${action.kind}.body`) : undefined}
      dismissible={!busy}
      size="lg"
    >
      <form onSubmit={submit} className="grid gap-5" noValidate>
        {action && NEEDS_REASON.includes(action.kind) ? (
          <Field label={t('moderation.form.reason')} error={errors.reason} required>
            <select value={reason} onChange={(e) => setReason(e.target.value as CommunityReason | '')}>
              <option value="">{t('moderation.form.chooseReason')}</option>
              {COMMUNITY_REASONS.map((value) => (
                <option key={value} value={value}>
                  {t(`reasons.${value}.label`)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {action?.kind === 'suspend' ? (
          <Field label={t('moderation.form.days')} hint={t('moderation.form.daysHint', { max: COMMUNITY_LIMITS.suspensionMaxDays })} error={errors.days} required>
            <input type="number" inputMode="numeric" min={1} max={COMMUNITY_LIMITS.suspensionMaxDays} value={days} onChange={(e) => setDays(e.target.value)} className="max-w-32 font-mono" />
          </Field>
        ) : null}
        <Field
          id={`${id}-statement`}
          label={t('moderation.form.statement')}
          hint={
            <span className="flex flex-wrap justify-between gap-2">
              <span>{t('moderation.form.statementHint')}</span>
              <CharCount value={statement} max={COMMUNITY_LIMITS.statementMax} />
            </span>
          }
          error={errors.statement}
          required
        >
          <textarea rows={4} value={statement} maxLength={COMMUNITY_LIMITS.statementMax} onChange={(e) => setStatement(e.target.value)} />
        </Field>
        {errors.submit ? (
          <p role="alert" className="m-0 text-ui font-medium text-danger">
            {errors.submit}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant={destructive ? 'danger' : 'primary'} loading={busy}>
            {action ? t(`moderation.actions.${action.kind}.confirm`) : ''}
          </Button>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {tc('cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ContentBlock({ content }: { content: ModerationContent }) {
  const t = useTranslations('community');
  const locale = useLocale();
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-meta text-ink-2">
        <Badge tone={content.targetType === 'POST' ? 'accent' : 'neutral'}>{t(`moderation.target.${content.targetType}`)}</Badge>
        {content.postType ? <Badge>{t(`type.${content.postType}`)}</Badge> : null}
        {content.status !== 'VISIBLE' ? (
          <Badge tone="warn" dot>
            {t(`moderation.status.${content.status}`)}
          </Badge>
        ) : null}
        <span className="font-medium text-ink">{content.authorHandle ? `@${content.authorHandle}` : t('card.formerMember')}</span>
        <span className="font-mono">{formatLongDate(content.createdAt, locale)}</span>
      </div>
      {content.body ? <PlainText text={content.body} className="rounded-control bg-sunken px-3 py-2 text-body text-ink" as="blockquote" /> : null}
      {content.media.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {content.media.map((m, i) =>
            isAllowedMediaUrl(m.url) ? (
              <li key={m.id} className="cv-photo size-24">
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette de contrôle */}
                <img src={m.url} alt={t('moderation.imageAlt', { n: i + 1 })} className="absolute inset-0 size-full object-cover" loading="lazy" />
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      {content.status === 'VISIBLE' && content.postId ? (
        <Link href={communityPostPath(content.postId)} className="justify-self-start text-meta text-accent-text underline underline-offset-2">
          {t('moderation.openPost')}
        </Link>
      ) : null}
    </div>
  );
}

function ContentActions({ content, onAction, withDismiss = false }: { content: ModerationContent; onAction: (a: PendingAction) => void; withDismiss?: boolean }) {
  const t = useTranslations('community');
  const hidden = content.status !== 'VISIBLE';
  return (
    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
      {hidden ? (
        <Button size="sm" variant="secondary" onClick={() => onAction({ kind: 'restore', content })}>
          {t('moderation.actions.restore.short')}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => onAction({ kind: 'hide', content })}>
          {t('moderation.actions.hide.short')}
        </Button>
      )}
      {withDismiss ? (
        <Button size="sm" variant="secondary" onClick={() => onAction({ kind: 'dismiss', content })}>
          {t('moderation.actions.dismiss.short')}
        </Button>
      ) : null}
      <Button size="sm" variant="quiet" onClick={() => onAction({ kind: 'delete', content })}>
        {t('moderation.actions.delete.short')}
      </Button>
      {content.authorHandle ? (
        <Button size="sm" variant="quiet" onClick={() => onAction({ kind: 'suspend', content, handle: content.authorHandle! })}>
          {t('moderation.actions.suspend.short')}
        </Button>
      ) : null}
    </div>
  );
}

function useLoader<T>(load: () => Promise<T>, version: number) {
  const [state, setState] = useState<{ version: number; data: T | null; error: CommunityErrorKey | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ version, data, error: null }))
      .catch((err: unknown) => !cancelled && setState({ version, data: null, error: communityErrorKey(err) }));
    return () => {
      cancelled = true;
    };
  }, [load, version]);
  return state;
}

function ListSkeleton() {
  const t = useTranslations('community');
  return (
    <SkeletonGroup label={t('moderation.loading')} className="grid gap-3">
      <Skeleton shape="block" height={160} />
      <Skeleton shape="block" height={160} />
    </SkeletonGroup>
  );
}

function QueuePanel({ version, onAction }: { version: number; onAction: (a: PendingAction) => void }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const reasonOf = useReasonLabel();
  const load = useCallback(() => moderationApi.queue(token), [token]);
  const state = useLoader(load, version);
  if (!state) return <ListSkeleton />;
  if (state.error) return <CommunityNotice errorKey={state.error} severity="urgent" />;
  const items: QueueItem[] = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState headingLevel={2} title={t('moderation.queueEmptyTitle')} benefit={t('moderation.queueEmptyBody')} />;
  return (
    <ul className="m-0 grid list-none gap-4 p-0">
      {items.map((item) => (
        <Card as="li" key={`${item.targetType}-${item.targetId}`} className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger" dot>
              {t('moderation.openReports', { count: item.openReports })}
            </Badge>
            {item.firstReportedAt ? <span className="font-mono text-meta text-ink-2">{t('moderation.firstReport', { date: formatLongDate(item.firstReportedAt, locale) })}</span> : null}
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t('moderation.reasonsLabel')}>
            {Object.entries(item.reasons).map(([reason, count]) => (
              <li key={reason}>
                <Badge>
                  {reasonOf(reason)} · <span className="font-mono">{count}</span>
                </Badge>
              </li>
            ))}
          </ul>
          <ContentBlock content={item} />
          {item.details.length > 0 ? (
            <details className="text-ui">
              <summary className="cursor-pointer text-accent-text">{t('moderation.details', { count: item.details.length })}</summary>
              <ul className="m-0 mt-2 grid list-none gap-2 p-0">
                {item.details.map((d, i) => (
                  <li key={i} className="grid gap-0.5 border-l border-line pl-3">
                    <span className="text-meta text-ink-2">
                      {reasonOf(d.reason)} · <span className="font-mono">{formatLongDate(d.createdAt, locale)}</span>
                    </span>
                    {d.details ? <PlainText text={d.details} className="text-ui text-ink" /> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <ContentActions content={item} onAction={onAction} withDismiss />
        </Card>
      ))}
    </ul>
  );
}

function HiddenPanel({ version, onAction }: { version: number; onAction: (a: PendingAction) => void }) {
  const t = useTranslations('community');
  const { token } = useCommunity();
  const load = useCallback(() => moderationApi.hidden(token), [token]);
  const state = useLoader(load, version);
  if (!state) return <ListSkeleton />;
  if (state.error) return <CommunityNotice errorKey={state.error} severity="urgent" />;
  const items = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState headingLevel={2} title={t('moderation.hiddenEmptyTitle')} benefit={t('moderation.hiddenEmptyBody')} />;
  return (
    <ul className="m-0 grid list-none gap-4 p-0">
      {items.map((item) => (
        <Card as="li" key={`${item.targetType}-${item.targetId}`} className="grid gap-4">
          <ContentBlock content={item} />
          <ContentActions content={item} onAction={onAction} />
        </Card>
      ))}
    </ul>
  );
}

function AppealsPanel({ version, onAction }: { version: number; onAction: (a: PendingAction) => void }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const titleOf = useDecisionTitle();
  const reasonOf = useReasonLabel();
  const load = useCallback(() => moderationApi.appeals(token), [token]);
  const state = useLoader(load, version);
  if (!state) return <ListSkeleton />;
  if (state.error) return <CommunityNotice errorKey={state.error} severity="urgent" />;
  const items: AppealItem[] = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState headingLevel={2} title={t('moderation.appealsEmptyTitle')} benefit={t('moderation.appealsEmptyBody')} />;
  return (
    <ul className="m-0 grid list-none gap-4 p-0">
      {items.map((item) => (
        <Card as="li" key={item.id} className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{titleOf(item)}</span>
            <AppealBadge status={item.appealStatus} />
            <span className="font-mono text-meta text-ink-2">{formatLongDate(item.createdAt, locale)}</span>
            {item.subjectHandle ? <span className="text-meta text-ink-2">@{item.subjectHandle}</span> : null}
          </div>
          <dl className="m-0 grid gap-3">
            <div className="grid gap-0.5">
              <dt className="text-meta text-ink-2">{t('decisions.facts.reason')}</dt>
              <dd className="m-0 text-ui text-ink">{reasonOf(item.reason)}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-meta text-ink-2">{t('decisions.statementTitle')}</dt>
              <dd className="m-0">
                <PlainText text={item.statement} className="text-ui text-ink" />
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-meta text-ink-2">{t('moderation.appealText')}</dt>
              <dd className="m-0">
                <PlainText text={item.appealText ?? ''} className="rounded-control bg-sunken px-3 py-2 text-ui text-ink" as="blockquote" />
              </dd>
            </div>
          </dl>
          {item.content ? <ContentBlock content={item.content} /> : null}
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button size="sm" variant="secondary" onClick={() => onAction({ kind: 'reverse', appealId: item.id, handle: item.subjectHandle ?? '' })}>
              {t('moderation.actions.reverse.short')}
            </Button>
            <Button size="sm" variant="quiet" onClick={() => onAction({ kind: 'uphold', appealId: item.id, handle: item.subjectHandle ?? '' })}>
              {t('moderation.actions.uphold.short')}
            </Button>
          </div>
        </Card>
      ))}
    </ul>
  );
}

function LogPanel({ version, onAction }: { version: number; onAction: (a: PendingAction) => void }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const titleOf = useDecisionTitle();
  const reasonOf = useReasonLabel();
  const fetchPage = useCallback((cursor: string | null) => moderationApi.log(token, cursor), [token]);
  const list = useCursorList<LogItem>(`log-${version}`, fetchPage);
  // Instant de référence (suspension encore en cours ?), figé au montage du panneau.
  const [now] = useState(() => Date.now());
  if (list.loading) return <ListSkeleton />;
  if (list.error) return <CommunityNotice errorKey={list.error} severity="urgent" onRetry={list.retry} />;
  if (list.items.length === 0) return <EmptyState headingLevel={2} title={t('moderation.logEmptyTitle')} benefit={t('moderation.logEmptyBody')} />;
  return (
    <>
      <ol className="m-0 grid list-none divide-y divide-line rounded-card border border-line bg-surface p-0">
        {list.items.map((item) => (
          <li key={item.id} className="grid gap-1 px-4 py-3">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{titleOf(item)}</span>
              {item.automated ? <Badge tone="info">{t('moderation.automated')}</Badge> : null}
              <AppealBadge status={item.appealStatus} />
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-meta text-ink-2">
              <span className="font-mono">{formatLongDate(item.createdAt, locale)}</span>
              {item.subjectHandle ? <span>@{item.subjectHandle}</span> : null}
              {item.reason ? <span>{reasonOf(item.reason)}</span> : null}
              <span>{item.operatorHandle ? t('moderation.by', { handle: item.operatorHandle }) : item.automated ? t('moderation.byAutomation') : t('moderation.byTeam')}</span>
              {item.notifiedAt ? null : <span className="text-warn">{t('moderation.notNotified')}</span>}
            </span>
            <PlainText text={item.statement} clamp className="text-ui text-ink" />
            {item.action === 'SUSPEND' && item.subjectHandle && item.suspendedUntil && new Date(item.suspendedUntil).getTime() > now ? (
              <div>
                <Button size="sm" variant="quiet" onClick={() => onAction({ kind: 'unsuspend', handle: item.subjectHandle! })}>
                  {t('moderation.actions.unsuspend.short')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <LoadMore count={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} error={list.moreError} onLoadMore={list.loadMore} allowAuto={false} />
    </>
  );
}

const TABS = ['queue', 'hidden', 'appeals', 'log'] as const;

function ModerationView() {
  const t = useTranslations('community');
  const { token } = useCommunity();
  const [tab, setTab] = useState<(typeof TABS)[number]>('queue');
  const [action, setAction] = useState<PendingAction | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // Accès : la file répond 403 à un compte qui n'est pas opérateur (ou dont l'e-mail n'est pas vérifié).
  useEffect(() => {
    let cancelled = false;
    moderationApi
      .queue(token)
      .then(() => !cancelled && setAllowed(true))
      .catch((err: unknown) => !cancelled && setAllowed(!(err instanceof ApiError && (err.status === 403 || err.status === 401))));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (allowed === null) return <ListSkeleton />;
  if (!allowed) {
    return <EmptyState size="page" headingLevel={2} title={t('moderation.forbiddenTitle')} benefit={t('moderation.forbiddenBody')} />;
  }

  return (
    <>
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])} className="grid gap-5">
        <Tabs.List aria-label={t('moderation.tabsLabel')} className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((value) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={cx(
                '-mb-px min-h-11 border-b-2 px-3 text-ui font-medium transition-colors',
                tab === value ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {t(`moderation.tabs.${value}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="queue">{tab === 'queue' ? <QueuePanel version={version} onAction={setAction} /> : null}</Tabs.Content>
        <Tabs.Content value="hidden">{tab === 'hidden' ? <HiddenPanel version={version} onAction={setAction} /> : null}</Tabs.Content>
        <Tabs.Content value="appeals">{tab === 'appeals' ? <AppealsPanel version={version} onAction={setAction} /> : null}</Tabs.Content>
        <Tabs.Content value="log">{tab === 'log' ? <LogPanel version={version} onAction={setAction} /> : null}</Tabs.Content>
      </Tabs.Root>
      <ActionModal
        action={action}
        token={token}
        onClose={() => setAction(null)}
        onDone={(message) => {
          setAction(null);
          setVersion((v) => v + 1);
          setToast(message);
        }}
      />
      {toast ? <Toast type="success" message={toast} onClose={() => setToast(null)} /> : null}
    </>
  );
}

/** File de modération (opérateurs) : signalements, contenus masqués, recours, journal. */
export default function CommunityModerationPage() {
  const t = useTranslations('community');
  return (
    <CommunityGate>
      <CommunityPage>
        <BackLink href="/communaute/profil">{t('profile.back')}</BackLink>
        <SectionHeader title={t('moderation.title')} description={t('moderation.lead')} />
        <ModerationView />
      </CommunityPage>
    </CommunityGate>
  );
}
