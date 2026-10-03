'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { GuestFeatureNote } from '@/components/guest/GuestFeatureNote';
import { NewTabPageLink } from '@/components/NewTabPageLink';
import { Alert, Button, ExternalLink, Skeleton, SkeletonGroup, cx } from '@/components/ui';
import {
  loadPaywall,
  purchasePlan,
  restorePlan,
  storeManageUrl,
  storePlatform,
  waitForBackendPremium,
  type PaywallLoad,
  type PaywallPlan,
  type PurchaseErrorReason,
  type StorePeriod,
} from '@/lib/purchases';

export interface NativePaywallProps {
  /** Lien de gestion renvoyé par l'API (`GET /users/me/subscription`), prioritaire sur celui du store. */
  manageUrl?: string | null;
  /** Premium confirmé par le backend (webhook reçu) : la page recharge son état, la modale se ferme. */
  onActivated?: () => void;
  className?: string;
}

type Phase = 'idle' | 'purchasing' | 'restoring' | 'activating' | 'pending' | 'active';

type Notice = { kind: 'error'; reason: PurchaseErrorReason } | { kind: 'restore-nothing' } | null;

const ERROR_KEYS: Record<PurchaseErrorReason, string> = {
  network: 'errors.network',
  unavailable: 'errors.unavailable',
  'not-allowed': 'errors.notAllowed',
  pending: 'errors.pending',
  'already-owned': 'errors.alreadyOwned',
  store: 'errors.store',
  'not-configured': 'errors.notConfigured',
  unknown: 'errors.unknown',
};

const linkClass = 'font-medium text-accent-text underline decoration-1 underline-offset-[0.18em] hover:text-ink';

/**
 * Paywall de l'app native (W6-08), conforme aux règles App Store (3.1.1, 3.1.2) et Google Play :
 * prix et durée lus dans l'offering du store (jamais codés en dur), renouvellement automatique et
 * résiliation expliqués avant l'achat, « Restaurer mes achats », CGU et confidentialité, gestion de
 * l'abonnement. Le Premium n'est affiché actif qu'après confirmation du backend (`/auth/me`).
 * Invité : le compte d'abord (sans perte de données).
 */
export function NativePaywall({ manageUrl, onActivated, className }: NativePaywallProps) {
  const t = useTranslations('paywall');
  const tGuest = useTranslations('guest');
  const { user, reloadUser } = useAuth();
  const groupId = useId();
  const [load, setLoad] = useState<PaywallLoad | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [notice, setNotice] = useState<Notice>(null);

  const userId = user?.id ?? null;
  const isGuest = user?.isGuest === true;

  useEffect(() => {
    let cancelled = false;
    void loadPaywall(userId ? { id: userId, isGuest } : null).then((result) => {
      if (cancelled) return;
      setLoad(result);
      if (result.status === 'ready' && result.plans.length > 0) {
        setSelectedId((current) => {
          if (current && result.plans.some((p) => p.id === current)) return current;
          return (result.plans.find((p) => p.kind === 'annual') ?? result.plans[0]).id;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isGuest, attempt]);

  const platform = storePlatform();
  const sessionUser = userId ? { id: userId, isGuest } : null;

  const per = (p: StorePeriod) => t(`per.${p.unit}`, { count: p.count });
  const planName = (p: StorePeriod) => t(`planName.${p.unit}`, { count: p.count });
  const duration = (p: StorePeriod) => t(`duration.${p.unit}`, { count: p.count });

  const introText = (plan: PaywallPlan): string | null => {
    const intro = plan.intro;
    if (!intro) return null;
    const total = duration({ unit: intro.period.unit, count: intro.period.count * intro.cycles });
    return intro.price === 0
      ? t('introFree', { duration: total, price: plan.priceString, per: per(plan.period) })
      : t('introPaid', { introPrice: intro.priceString, introPer: per(intro.period), duration: total, price: plan.priceString, per: per(plan.period) });
  };

  const activate = useCallback(
    async (timeoutMs?: number) => {
      setPhase('activating');
      const result = await waitForBackendPremium(async () => Boolean((await reloadUser())?.isPremium), { timeoutMs });
      if (result === 'active') {
        setPhase('active');
        onActivated?.();
      } else {
        setPhase('pending');
      }
    },
    [reloadUser, onActivated],
  );

  if (isGuest) {
    // L'achat exige un compte : passage invité → compte d'abord.
    return <GuestFeatureNote className={className}>{tGuest('subscriptionNote')}</GuestFeatureNote>;
  }

  if (load === null) {
    return (
      <SkeletonGroup label={t('loading')} className={cx('grid gap-3', className)}>
        <Skeleton shape="block" height={64} />
        <Skeleton shape="block" height={64} />
        <Skeleton height={44} />
      </SkeletonGroup>
    );
  }

  if (load.status === 'web') return null;

  if (load.status === 'missing-key') {
    return (
      <Alert severity="info" className={className} title={t('unavailableTitle')}>
        {t('unavailableText')}
      </Alert>
    );
  }

  const plans = load.status === 'ready' ? load.plans : [];
  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const busy = phase === 'purchasing' || phase === 'restoring' || phase === 'activating';
  const manageHref = manageUrl || storeManageUrl(platform);

  const onPurchase = async () => {
    if (!selected || busy) return;
    setNotice(null);
    setPhase('purchasing');
    const outcome = await purchasePlan(sessionUser, selected);
    if (outcome.status === 'purchased') {
      await activate();
      return;
    }
    setPhase('idle');
    // Annulation : l'utilisateur a fermé la feuille du store, rien à signaler.
    if (outcome.status === 'error') setNotice({ kind: 'error', reason: outcome.reason });
  };

  const onRestore = async () => {
    if (busy) return;
    setNotice(null);
    setPhase('restoring');
    const outcome = await restorePlan(sessionUser);
    if (outcome.status === 'restored') {
      await activate();
      return;
    }
    setPhase('idle');
    setNotice(outcome.status === 'nothing' ? { kind: 'restore-nothing' } : { kind: 'error', reason: outcome.reason });
  };

  return (
    <div className={cx('grid gap-4', className)}>
      {load.status === 'error' ? (
        <Alert
          severity="warning"
          title={t('loadErrorTitle')}
          action={
            <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              {t('retry')}
            </Button>
          }
        >
          {t(ERROR_KEYS[load.reason])}
        </Alert>
      ) : null}

      {load.status === 'ready' && plans.length === 0 ? (
        <Alert severity="info" title={t('emptyTitle')}>
          {t('emptyText')}
        </Alert>
      ) : null}

      {plans.length > 0 ? (
        <fieldset className="m-0 grid gap-3 border-0 p-0" disabled={busy}>
          <legend className="mb-1 p-0 font-medium text-ink">{t('choosePlan')}</legend>
          {plans.map((plan) => {
            const checked = plan.id === selectedId;
            const intro = introText(plan);
            return (
              <label
                key={plan.id}
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-control border px-4 py-3 transition-colors',
                  checked ? 'border-ink bg-accent-soft' : 'border-line-field bg-surface hover:bg-sunken',
                )}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={plan.id}
                  checked={checked}
                  onChange={() => setSelectedId(plan.id)}
                  className="mt-1 size-4 shrink-0"
                />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium text-ink">{planName(plan.period)}</span>
                  <span className="font-mono text-ink">
                    {t('priceLine', { price: plan.priceString, per: per(plan.period) })}
                  </span>
                  {intro ? <span className="text-ui text-ink-2">{intro}</span> : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {selected ? (
        <Button fullWidth loading={phase === 'purchasing'} disabled={busy} onClick={() => void onPurchase()}>
          {t('subscribe', { price: selected.priceString, per: per(selected.period) })}
        </Button>
      ) : null}

      <div aria-live="polite" className="grid gap-3 empty:hidden">
        {phase === 'activating' ? (
          <Alert severity="info" title={t('activatingTitle')}>
            {t('activatingText')}
          </Alert>
        ) : null}
        {phase === 'pending' ? (
          <Alert
            severity="info"
            title={t('activatingTitle')}
            action={
              <Button variant="secondary" size="sm" onClick={() => void activate(5_000)}>
                {t('checkAgain')}
              </Button>
            }
          >
            {t('pendingText')}
          </Alert>
        ) : null}
        {phase === 'active' ? <Alert severity="info" title={t('activeTitle')}>{t('activeText')}</Alert> : null}
        {notice?.kind === 'error' ? (
          <Alert severity={notice.reason === 'pending' ? 'info' : 'warning'} title={t(ERROR_KEYS[notice.reason])} />
        ) : null}
        {notice?.kind === 'restore-nothing' ? <Alert severity="info" title={t('restoreNothing')} /> : null}
      </div>

      <div className="grid gap-2 text-ui text-ink-2">
        <p className="m-0">{platform === 'android' ? t('termsAndroid') : t('termsIos')}</p>
        <p className="m-0">{t('deletionNote')}</p>
      </div>

      <Button variant="secondary" fullWidth loading={phase === 'restoring'} disabled={busy} onClick={() => void onRestore()}>
        {t('restore')}
      </Button>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-ui">
        <li>
          <NewTabPageLink href="/cgu" className={linkClass}>
            {t('terms')}
          </NewTabPageLink>
        </li>
        <li>
          <NewTabPageLink href="/confidentialite" className={linkClass}>
            {t('privacy')}
          </NewTabPageLink>
        </li>
        {manageHref ? (
          <li>
            <ExternalLink href={manageHref} className={linkClass}>
              {t('manage')}
            </ExternalLink>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default NativePaywall;
