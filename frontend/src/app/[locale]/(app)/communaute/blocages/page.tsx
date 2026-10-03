'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, EmptyState, SectionHeader, Skeleton, SkeletonGroup } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, useCommunity } from '@/components/community/CommunityGate';
import { BackLink, CommunityAvatar } from '@/components/community/primitives';
import { communityApi, communityErrorKey, formatLongDate, type BlockedMember, type CommunityErrorKey } from '@/lib/community';

function BlocksView() {
  const t = useTranslations('community');
  const locale = useLocale();
  const { token } = useCommunity();
  const [items, setItems] = useState<BlockedMember[] | null>(null);
  const [error, setError] = useState<CommunityErrorKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ handle: string; message: string } | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    communityApi
      .blocks(token)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setError(null);
        }
      })
      .catch((err: unknown) => !cancelled && setError(communityErrorKey(err)));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const unblock = async (handle: string) => {
    setBusy(handle);
    setRowError(null);
    try {
      await communityApi.unblock(token, handle);
      setItems((prev) => (prev ? prev.filter((m) => m.handle !== handle) : prev));
      setStatus(t('blocks.unblocked', { handle }));
    } catch (err) {
      setRowError({ handle, message: t(`errors.${communityErrorKey(err)}.title`) });
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <CommunityNotice
        errorKey={error}
        severity="urgent"
        onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!items) {
    return (
      <SkeletonGroup label={t('blocks.loading')} className="grid gap-3">
        <Skeleton shape="block" height={64} />
        <Skeleton shape="block" height={64} />
      </SkeletonGroup>
    );
  }
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {items.length === 0 ? (
        <EmptyState headingLevel={2} title={t('blocks.emptyTitle')} benefit={t('blocks.emptyBody')} />
      ) : (
        <ul className="m-0 grid list-none divide-y divide-line rounded-card border border-line bg-surface p-0">
          {items.map((member) => (
            <li key={member.handle} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <CommunityAvatar url={member.avatarUrl} size={40} />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-ui font-semibold text-ink">@{member.handle}</span>
                <span className="font-mono text-meta text-ink-2">{t('blocks.since', { date: formatLongDate(member.blockedAt, locale) })}</span>
                {rowError?.handle === member.handle ? (
                  <span role="alert" className="text-meta font-medium text-danger">
                    {rowError.message}
                  </span>
                ) : null}
              </div>
              <Button variant="secondary" size="sm" loading={busy === member.handle} onClick={() => unblock(member.handle)} aria-label={t('blocks.unblockHandle', { handle: member.handle })}>
                {t('blocks.unblock')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Personnes bloquées : leurs contenus vous sont masqués, et les vôtres leur sont masqués. */
export default function CommunityBlocksPage() {
  const t = useTranslations('community');
  return (
    <CommunityGate>
      <CommunityPage narrow>
        <BackLink href="/communaute/profil">{t('profile.back')}</BackLink>
        <SectionHeader title={t('blocks.title')} description={t('blocks.lead')} />
        <BlocksView />
      </CommunityPage>
    </CommunityGate>
  );
}
