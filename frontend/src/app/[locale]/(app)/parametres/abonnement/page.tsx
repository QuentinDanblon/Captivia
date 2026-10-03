'use client';

import { useCallback, useState, useEffect, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, type SubscriptionStatusView } from '@/lib/api';
import { isGuestUser } from '@/lib/guest';
import { useIsNative } from '@/lib/platform';
import { isPendingStoreLink, storeLinks } from '@/lib/store-links';
import { GuestFeatureNote } from '@/components/guest/GuestFeatureNote';
import { NativePaywall } from '@/components/purchases/NativePaywall';
import { Alert, Badge, Card, ExternalLink, PremiumBadge, Skeleton, SkeletonGroup, buttonClasses, cx } from '@/components/ui';
import { SettingsHeader } from '../_components/SettingsHeader';

/** Lignes du comparatif : ce que chaque formule comprend (API : limite d'animaux, page publique, reproduction). */
const FEATURES: { key: string; free: boolean | 'one'; premium: boolean | 'unlimited' }[] = [
  { key: 'animals', free: 'one', premium: 'unlimited' },
  { key: 'record', free: true, premium: true },
  { key: 'reminders', free: true, premium: true },
  { key: 'print', free: true, premium: true },
  { key: 'species', free: true, premium: true },
  { key: 'export', free: true, premium: true },
  { key: 'publicPage', free: false, premium: true },
  { key: 'breeding', free: false, premium: true },
];

function Check({ label }: { label: string }) {
  return (
    <>
      <svg viewBox="0 0 16 16" className="mx-auto size-4 text-ok" fill="none" aria-hidden="true">
        <path d="M3.2 8.4 6.4 11.4 12.8 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </>
  );
}

function Dash({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-ink-2">
        —
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

interface PlanCardProps {
  name: ReactNode;
  audience: string;
  price: ReactNode;
  priceNote: ReactNode;
  points: string[];
  current: boolean;
  currentLabel: string;
  featured?: boolean;
  footer?: ReactNode;
  id: string;
}

/** Une formule : nom, pour qui, prix, trois points, et l'état ou l'action. */
function PlanCard({ name, audience, price, priceNote, points, current, currentLabel, featured, footer, id }: PlanCardProps) {
  return (
    <Card
      as="article"
      aria-labelledby={id}
      padding="lg"
      tone={featured ? 'surface' : 'outline'}
      className={cx('relative flex flex-col gap-6', featured && 'shadow-[inset_0_3px_0_var(--ink)]')}
    >
      <header className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id={id} className="m-0 font-display text-h3 text-ink">
            {name}
          </h3>
          {current ? (
            <Badge tone="accent" dot>
              {currentLabel}
            </Badge>
          ) : null}
        </div>
        <p className="m-0 text-ui text-ink-2">{audience}</p>
      </header>

      <div className="grid gap-1 border-y border-line py-5">
        <p className="m-0 flex items-baseline gap-1.5 text-ink">{price}</p>
        <p className="m-0 text-ui text-ink-2">{priceNote}</p>
      </div>

      <ul className="m-0 grid list-none gap-3 p-0">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-body text-ink">
            <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-ok" fill="none" aria-hidden="true">
              <path d="M3.2 8.4 6.4 11.4 12.8 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      {footer ? <div className="mt-auto grid gap-3 pt-2">{footer}</div> : null}
    </Card>
  );
}

/** Fiches de l'app sur les stores (web) ; marqueur `[À COMPLÉTER]` tant que l'app n'est pas publiée. */
function StoreLinks({ label }: { label: string }) {
  return (
    <ul aria-label={label} className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-ui">
      {storeLinks().map((link) => (
        <li key={link.key}>
          {isPendingStoreLink(link) ? (
            <span className="text-ink">
              {link.name}{' '}
              <mark className="rounded-control bg-warn-soft px-1 font-medium text-ink shadow-[inset_0_-1px_0_var(--warn)]">
                {link.href}
              </mark>
            </span>
          ) : (
            <ExternalLink
              href={link.href}
              className="font-medium text-accent-text underline decoration-1 underline-offset-[0.18em] hover:text-ink"
            >
              {link.name}
            </ExternalLink>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * W6-08 — L'abonnement Premium se souscrit uniquement dans l'application mobile
 * (achats intégrés App Store / Google Play, RevenueCat). Dans l'app native : paywall du store
 * (`NativePaywall`). Le web affiche l'état et le lien de gestion, jamais de bouton d'achat. Offre (docs/PRODUCT.md) : gratuit = 1 animal et son carnet complet ;
 * Premium = plusieurs animaux (+ page publique, reproduction). Aucun prix affiché sur le web :
 * le tarif vient des stores (RevenueCat) et s'affiche dans l'app avant tout achat.
 */
export default function AbonnementPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const native = useIsNative();
  const [status, setStatus] = useState<SubscriptionStatusView | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadStatus = useCallback(() => {
    if (!token) return;
    api
      .getSubscription(token)
      .then(setStatus)
      .catch(() => setStatus({ premium: false, isPremium: false }));
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (authLoading || (token && status === null)) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('common.loading')} className="grid gap-6">
          <Skeleton width="45%" height={40} />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton shape="block" height={420} />
            <Skeleton shape="block" height={420} />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  const guest = isGuestUser(user);
  const premium = Boolean(status?.premium ?? status?.isPremium);
  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString(locale, { dateStyle: 'long' })
    : null;
  const currentLabel = t('plans.yourPlan');

  const freeFooter = !premium && !guest ? <p className="m-0 text-ui text-ink-2">{t('plans.freeFooter')}</p> : null;

  let premiumFooter: ReactNode;
  if (premium) {
    premiumFooter = status?.manageUrl ? (
      <ExternalLink
        href={status.manageUrl}
        className={buttonClasses({ variant: 'secondary', fullWidth: true })}
      >
        {t('subscription.manage')}
        <span className="sr-only"> {t('plans.newTab')}</span>
      </ExternalLink>
    ) : null;
  } else if (guest) {
    // Invité : l'achat exige d'abord un compte (l'API répond 403 GUEST_ACCOUNT).
    premiumFooter = <GuestFeatureNote>{t('guest.subscriptionNote')}</GuestFeatureNote>;
  } else if (native) {
    // App native : achat intégré (prix et durée lus dans le store), restauration, gestion.
    premiumFooter = <NativePaywall manageUrl={status?.manageUrl ?? null} onActivated={loadStatus} />;
  } else {
    premiumFooter = (
      <div className="grid gap-1 rounded-control bg-sunken px-4 py-3" role="note">
        <p className="m-0 font-medium text-ink">{t('plans.whereTitle')}</p>
        <p className="m-0 text-ui text-ink-2">{t('plans.whereText')}</p>
        <StoreLinks label={t('plans.storeLinksLabel')} />
      </div>
    );
  }

  return (
    <div className="cv-container grid gap-10 py-6 sm:py-8">
      <SettingsHeader
        title={t('plans.title')}
        description={t('plans.lead')}
        marginNote={premium ? t('guest.premium') : t('settings.planFreeShort')}
        marginLabel={t('plans.currentPlanLabel')}
      />

      {/* Abonnement store connu : état, échéance, gestion. */}
      {status?.source ? (
        <Card as="section" title={t('subscription.statusTitle')} titleId="subscription-status-title">
          <dl className="m-0 grid gap-4 text-ui sm:grid-cols-3">
            <div className="grid gap-1">
              <dt className="text-ink-2">{t('plans.statusPlan')}</dt>
              <dd className="m-0 flex items-center gap-2 text-ink">
                {premium ? <PremiumBadge label={t('guest.premium')} /> : t('settings.planFreeShort')}
                {status.plan ? <span>{status.plan === 'yearly' ? t('subscription.yearly') : t('subscription.monthly')}</span> : null}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-ink-2">{t('subscription.sourceLabel')}</dt>
              <dd className="m-0 text-ink">{t(`subscription.source${status.source}`)}</dd>
            </div>
            {premium && periodEnd ? (
              <div className="grid gap-1">
                <dt className="text-ink-2">{status.willRenew ? t('plans.renewsLabel') : t('plans.endsLabel')}</dt>
                <dd className="m-0 font-mono text-ink">{periodEnd}</dd>
              </div>
            ) : null}
          </dl>
          {status.status === 'BILLING_ISSUE' ? (
            <Alert severity="warning" className="mt-5" title={t('subscription.billingIssue')} />
          ) : null}
          {status.status === 'EXPIRED' || status.status === 'REFUNDED' ? (
            <Alert severity="info" className="mt-5" title={t('subscription.expired')} />
          ) : null}
        </Card>
      ) : null}

      <section aria-labelledby="plans-heading" className="grid gap-4">
        <h2 id="plans-heading" className="m-0 font-display text-h2 text-ink">
          {t('plans.choiceTitle')}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <PlanCard
            id="plan-free"
            name={t('plans.freeName')}
            audience={t('plans.freeAudience')}
            price={<span className="font-mono text-h3 font-medium">{t('plans.freePrice')}</span>}
            priceNote={t('plans.freePriceNote')}
            points={[t('plans.freePoint1'), t('plans.freePoint2'), t('plans.freePoint3')]}
            current={!premium}
            currentLabel={currentLabel}
            footer={freeFooter}
          />
          <PlanCard
            id="plan-premium"
            featured
            name={
              <span className="inline-flex items-center gap-3">
                {t('guest.premium')}
                <PremiumBadge label={t('plans.premiumTag')} />
              </span>
            }
            audience={t('plans.premiumAudience')}
            // Aucun prix codé en dur : le tarif réel vient des stores (RevenueCat) et s'affiche dans l'app.
            price={<span className="font-display text-h3 font-semibold">{t('plans.premiumPrice')}</span>}
            priceNote={t('plans.premiumPriceNote')}
            points={[t('plans.premiumPoint1'), t('plans.premiumPoint2'), t('plans.premiumPoint3')]}
            current={premium}
            currentLabel={currentLabel}
            footer={premiumFooter}
          />
        </div>
      </section>

      <section aria-labelledby="compare-heading" className="grid max-w-3xl gap-4">
        <h2 id="compare-heading" className="m-0 font-display text-h3 text-ink">
          {t('plans.compareTitle')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] border-collapse text-left text-ui">
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="py-3 pr-4 font-medium text-ink-2">
                  {t('plans.featureColumn')}
                </th>
                <th scope="col" className="w-20 py-3 text-center font-medium text-ink sm:w-32">
                  {t('plans.freeName')}
                </th>
                <th scope="col" className="w-20 py-3 text-center font-medium text-ink sm:w-32">
                  {t('guest.premium')}
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature) => (
                <tr key={feature.key} className="border-b border-line">
                  <th scope="row" className="py-3 pr-4 font-normal text-ink">
                    {t(`plans.features.${feature.key}`)}
                  </th>
                  <td className="py-3 text-center">
                    {feature.free === 'one' ? (
                      <span className="font-mono text-ink">1</span>
                    ) : feature.free ? (
                      <Check label={t('plans.included')} />
                    ) : (
                      <Dash label={t('plans.notIncluded')} />
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {feature.premium === 'unlimited' ? (
                      <span className="font-mono text-ink">{t('plans.unlimited')}</span>
                    ) : (
                      <Check label={t('plans.included')} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="grid gap-x-6 gap-y-4 md:grid-cols-12">
        <h2 id="faq-heading" className="m-0 font-display text-h3 text-ink md:col-span-4">
          {t('plans.faqTitle')}
        </h2>
        <dl className="m-0 grid md:col-span-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="grid gap-1 border-t border-line py-4">
              <dt className="font-medium text-ink">{t(`plans.faq${n}Q`)}</dt>
              <dd className="m-0 text-ui text-ink-2">{t(`plans.faq${n}A`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
