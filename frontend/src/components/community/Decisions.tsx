'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import {
  COMMUNITY_LIMITS,
  COMMUNITY_REASONS,
  communityApi,
  communityErrorKey,
  formatLongDate,
  type CommunityErrorKey,
  type ModerationDecision,
  type MyReport,
} from '@/lib/community';
import { communityDecisionPath, communityPostPath } from '@/lib/platform';
import { AnimalSilhouette, Alert, Badge, Button, Card, EmptyState, Field, SectionHeader, Skeleton, SkeletonGroup, buttonClasses, type BadgeTone } from '@/components/ui';
import { CommunityNotice, useCommunity } from './CommunityGate';
import { CharCount, PlainText } from './primitives';
import { LoadMore, useCursorList } from './useCursorList';

const TITLE_KEYS = new Set([
  'AUTO_HIDE_POST',
  'AUTO_HIDE_COMMENT',
  'HIDE_POST',
  'HIDE_COMMENT',
  'RESTORE_POST',
  'RESTORE_COMMENT',
  'DELETE_POST',
  'DELETE_COMMENT',
  'SUSPEND_USER',
  'UNSUSPEND_USER',
]);

/** Titre lisible d'une décision (« Publication masquée », « Publication suspendue »…). */
export function useDecisionTitle() {
  const t = useTranslations('community');
  return (d: Pick<ModerationDecision, 'action' | 'targetType'>) => {
    const key = `${d.action}_${d.targetType}`;
    return TITLE_KEYS.has(key) ? t(`decisions.titles.${key}`) : t('decisions.titles.OTHER');
  };
}

/** Motif traduit (liste fermée), sinon « Autre manquement ». */
export function useReasonLabel() {
  const t = useTranslations('community');
  return (reason: string | null | undefined) =>
    reason && (COMMUNITY_REASONS as readonly string[]).includes(reason) ? t(`reasons.${reason}.label`) : t('reasons.OTHER.label');
}

const APPEAL_TONE: Record<string, BadgeTone> = { PENDING: 'info', UPHELD: 'neutral', REVERSED: 'ok' };

export function AppealBadge({ status }: { status: ModerationDecision['appealStatus'] }) {
  const t = useTranslations('community');
  if (status === 'NONE') return null;
  return (
    <Badge tone={APPEAL_TONE[status] ?? 'neutral'} dot>
      {t(`decisions.appealStatus.${status}`)}
    </Badge>
  );
}

/** Liste des décisions me concernant. */
export function DecisionList() {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const titleOf = useDecisionTitle();
  const fetchPage = useCallback((cursor: string | null) => communityApi.myDecisions(token, cursor), [token]);
  const list = useCursorList<ModerationDecision>('decisions', fetchPage);

  if (list.loading) {
    return (
      <SkeletonGroup label={t('decisions.loading')} className="grid gap-3">
        <Skeleton shape="block" height={72} />
        <Skeleton shape="block" height={72} />
      </SkeletonGroup>
    );
  }
  if (list.error) return <CommunityNotice errorKey={list.error} severity="urgent" onRetry={list.retry} />;
  if (list.items.length === 0) {
    return <EmptyState headingLevel={2} illustration={<AnimalSilhouette kind="bird" size={56} />} title={t('decisions.emptyTitle')} benefit={t('decisions.emptyBody')} />;
  }
  return (
    <>
      <ul className="m-0 grid list-none divide-y divide-line rounded-card border border-line bg-surface p-0">
        {list.items.map((d) => (
          <li key={d.id}>
            <Link href={communityDecisionPath(d.id)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-ink no-underline transition-colors hover:bg-sunken">
              <span className="grid gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{titleOf(d)}</span>
                  <AppealBadge status={d.appealStatus} />
                  {d.canAppeal ? <Badge tone="warn">{t('decisions.appealOpen')}</Badge> : null}
                </span>
                <span className="font-mono text-meta text-ink-2">{formatLongDate(d.createdAt, locale)}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
      <LoadMore count={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} error={list.moreError} onLoadMore={list.loadMore} allowAuto={false} />
    </>
  );
}

const REPORT_TONE: Record<string, BadgeTone> = { OPEN: 'info', ACTIONED: 'ok', DISMISSED: 'neutral' };

/**
 * Mes signalements et leur suite (`GET /community/me/reports`). Tant que la route n'existe pas
 * (404), la section n'est pas affichée ; toute autre erreur reste discrète.
 */
export function MyReports() {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const reasonOf = useReasonLabel();
  const [state, setState] = useState<{ items: MyReport[] } | 'absent' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    communityApi
      .myReports(token)
      .then((page) => !cancelled && setState({ items: page.items }))
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(err instanceof ApiError && (err.status === 404 || err.status === 405) ? 'absent' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === null || state === 'absent') return null;
  return (
    <Card as="section" title={t('reports.title')} titleId="mes-signalements">
      {state === 'error' ? (
        <p className="m-0 text-ui text-ink-2">{t('reports.error')}</p>
      ) : state.items.length === 0 ? (
        <p className="m-0 text-ui text-ink-2">{t('reports.empty')}</p>
      ) : (
        <ul className="m-0 grid list-none divide-y divide-line p-0">
          {state.items.map((r) => {
            const status = r.status && ['OPEN', 'ACTIONED', 'DISMISSED'].includes(r.status) ? r.status : 'OPEN';
            const postId = r.postId ?? (r.targetType === 'POST' ? r.targetId : null);
            return (
              <li key={r.id} className="grid gap-1 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-ui font-medium text-ink">{reasonOf(r.reason)}</span>
                  <Badge tone={REPORT_TONE[status]} dot>
                    {t(`reports.status.${status}`)}
                  </Badge>
                </span>
                {r.excerpt ? <PlainText text={r.excerpt} clamp className="text-ui text-ink-2" /> : null}
                <span className="flex flex-wrap items-center gap-3">
                  {r.createdAt ? <span className="font-mono text-meta text-ink-2">{formatLongDate(r.createdAt, locale)}</span> : null}
                  {postId && status === 'OPEN' ? (
                    <Link href={communityPostPath(postId)} className="text-meta text-accent-text underline underline-offset-2">
                      {t('reports.seeContent')}
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Une décision : exposé des motifs, voies de recours, formulaire de recours (DSA art. 17 et 20). */
export function DecisionDetail({ id }: { id: string }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const titleOf = useDecisionTitle();
  const reasonOf = useReasonLabel();
  const formId = useId();
  const [state, setState] = useState<{ id: string; data: ModerationDecision | null; error: CommunityErrorKey | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    communityApi
      .myDecision(token, id)
      .then((data) => !cancelled && setState({ id, data, error: null }))
      .catch((err: unknown) => !cancelled && setState({ id, data: null, error: communityErrorKey(err) }));
    return () => {
      cancelled = true;
    };
  }, [token, id, attempt]);

  if (!state || state.id !== id) {
    return (
      <SkeletonGroup label={t('decisions.loading')} className="grid gap-4">
        <Skeleton width="50%" height={36} />
        <Skeleton shape="block" height={200} />
      </SkeletonGroup>
    );
  }
  if (state.error === 'notFound') {
    return (
      <EmptyState
        size="page"
        headingLevel={1}
        title={t('decisions.notFoundTitle')}
        benefit={t('decisions.notFoundBody')}
        action={
          <Link href="/communaute/decisions" className={buttonClasses({ variant: 'secondary' })}>
            {t('decisions.backToList')}
          </Link>
        }
      />
    );
  }
  if (state.error || !state.data) return <CommunityNotice errorKey={state.error ?? 'generic'} severity="urgent" onRetry={() => setAttempt((n) => n + 1)} />;
  const d = state.data;
  const tooShort = text.trim().length < COMMUNITY_LIMITS.appealMin;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (tooShort) {
      setFormError(t('decisions.appealTooShort', { min: COMMUNITY_LIMITS.appealMin }));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const updated = await communityApi.appeal(token, d.id, text.trim());
      setState({ id, data: { ...d, ...updated }, error: null });
      setSent(true);
      setText('');
    } catch (err) {
      setFormError(`${t(`errors.${communityErrorKey(err)}.title`)} ${t(`errors.${communityErrorKey(err)}.body`)}`);
    } finally {
      setBusy(false);
    }
  };

  const facts: Array<[string, React.ReactNode]> = [
    [t('decisions.facts.date'), <span key="d" className="font-mono">{formatLongDate(d.createdAt, locale)}</span>],
    [t('decisions.facts.reason'), reasonOf(d.reason)],
    [t('decisions.facts.automated'), d.automated ? t('decisions.automatedYes') : t('decisions.automatedNo')],
  ];
  if (d.suspendedUntil) facts.push([t('decisions.facts.until'), <span key="u" className="font-mono">{formatLongDate(d.suspendedUntil, locale)}</span>]);
  if (d.appealDeadline) facts.push([t('decisions.facts.deadline'), <span key="dl" className="font-mono">{formatLongDate(d.appealDeadline, locale)}</span>]);

  return (
    <>
      <SectionHeader title={titleOf(d)} marginNote={formatLongDate(d.createdAt, locale)} marginLabel={t('decisions.facts.date')} description={t('decisions.detailLead')} />

      {sent ? <Alert severity="info" title={t('decisions.appealSent')}>{t('decisions.appealSentBody')}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid content-start gap-6 lg:col-span-7">
          <Card as="section" title={t('decisions.statementTitle')} titleId="motifs">
            <PlainText text={d.statement} className="text-body text-ink" />
            {d.targetId && d.action !== 'DELETE' && d.targetType === 'POST' ? (
              <Link href={communityPostPath(d.targetId)} className="mt-4 inline-block text-ui text-accent-text underline underline-offset-2">
                {t('decisions.seeContent')}
              </Link>
            ) : null}
          </Card>

          {d.appealStatus !== 'NONE' ? (
            <Card as="section" title={t('decisions.appealTitle')} titleId="recours">
              <div className="grid gap-3">
                <AppealBadge status={d.appealStatus} />
                {d.appealStatement ? <PlainText text={d.appealStatement} className="text-body text-ink" /> : <p className="m-0 text-body text-ink-2">{t('decisions.appealPendingBody')}</p>}
                {d.appealResolvedAt ? <p className="m-0 font-mono text-meta text-ink-2">{formatLongDate(d.appealResolvedAt, locale)}</p> : null}
              </div>
            </Card>
          ) : d.canAppeal ? (
            <Card as="section" title={t('decisions.appealFormTitle')} titleId="faire-appel">
              <form onSubmit={submit} className="grid gap-4" noValidate>
                <p className="m-0 text-body text-ink-2">{t('decisions.appealIntro')}</p>
                <Field
                  id={`${formId}-text`}
                  label={t('decisions.appealLabel')}
                  hint={<CharCount value={text} max={COMMUNITY_LIMITS.appealMax} />}
                  error={formError ?? undefined}
                  required
                >
                  <textarea rows={5} value={text} maxLength={COMMUNITY_LIMITS.appealMax} onChange={(e) => setText(e.target.value)} />
                </Field>
                <div>
                  <Button type="submit" loading={busy}>
                    {t('decisions.appealSubmit')}
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <p className="m-0 text-ui text-ink-2">{t('decisions.appealClosed')}</p>
          )}
        </div>

        <div className="grid content-start gap-4 lg:col-span-5">
          <Card tone="sunken">
            <dl className="m-0 grid gap-3">
              {facts.map(([label, value]) => (
                <div key={label} className="grid gap-0.5">
                  <dt className="text-meta text-ink-2">{label}</dt>
                  <dd className="m-0 text-ui text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card tone="outline" className="grid gap-2">
            <h2 className="m-0 font-display text-h4 font-semibold text-ink">{t('decisions.remediesTitle')}</h2>
            <p className="m-0 text-ui text-ink-2">{t('decisions.remediesBody')}</p>
            {d.contactEmail ? <p className="m-0 text-ui text-ink-2">{t('decisions.contact', { email: d.contactEmail })}</p> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
