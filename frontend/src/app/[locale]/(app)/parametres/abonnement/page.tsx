'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, type SubscriptionStatusView } from '@/lib/api';
import { isGuestUser } from '@/lib/guest';
import { GuestFeatureNote } from '@/components/guest/GuestFeatureNote';

/**
 * W6-08 — L'abonnement Premium se souscrit uniquement dans l'application mobile
 * (achats intégrés App Store / Google Play). Le web affiche l'état et le lien de gestion,
 * jamais de bouton d'achat.
 */
export default function AbonnementPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatusView | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) {
      api
        .getSubscription(token)
        .then(setStatus)
        .catch(() => setStatus({ premium: false, isPremium: false }));
    }
  }, [token]);

  if (authLoading || (token && status === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4" />
          <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const premium = Boolean(status?.premium ?? status?.isPremium);
  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString(locale, { dateStyle: 'long' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <Link href="/parametres" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-6">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('common.back')} {t('common.settings')}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">{t('subscription.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{t('subscription.subtitle')}</p>

        {status?.source && (
          <section className="mb-8 p-5 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600" aria-labelledby="subscription-status-title">
            <h2 id="subscription-status-title" className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t('subscription.statusTitle')}</h2>
            {premium && (
              <p className="mb-2 text-emerald-700 dark:text-emerald-300 font-medium">{t('subscription.currentPlan')}</p>
            )}
            <p className="text-gray-700 dark:text-gray-300">
              {t('subscription.sourceLabel')} : {t(`subscription.source${status.source}`)}
            </p>
            {status.status === 'BILLING_ISSUE' && (
              <p className="mt-2 text-amber-700 dark:text-amber-300">{t('subscription.billingIssue')}</p>
            )}
            {(status.status === 'EXPIRED' || status.status === 'REFUNDED') && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t('subscription.expired')}</p>
            )}
            {premium && periodEnd && (
              <p className="mt-2 text-gray-700 dark:text-gray-300">
                {status.willRenew ? t('subscription.renewsOn', { date: periodEnd }) : t('subscription.endsOn', { date: periodEnd })}
              </p>
            )}
            {status.manageUrl && (
              <a
                href={status.manageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block py-2.5 px-4 rounded-xl border-2 border-emerald-600 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              >
                {t('subscription.manage')}
              </a>
            )}
          </section>
        )}

        <ul className="mb-8 space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2"><span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>{t('subscription.benefitAnimals')}</li>
          <li className="flex items-start gap-2"><span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>{t('subscription.benefitHealth')}</li>
          <li className="flex items-start gap-2"><span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>{t('subscription.benefitQR')}</li>
        </ul>

        {/* Invité : l'achat exige d'abord un compte (l'API répond 403 GUEST_ACCOUNT). */}
        {!premium && isGuestUser(user) && (
          <GuestFeatureNote>{t('guest.subscriptionNote')}</GuestFeatureNote>
        )}

        {!premium && !isGuestUser(user) && (
          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 p-6" role="note">
            <p className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{t('subscription.inAppOnly')}</p>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{t('subscription.inAppOnlyHint')}</p>
            <p className="text-gray-700 dark:text-gray-300">
              {t('subscription.monthly')} : {t('subscription.priceMonthly')}{t('subscription.perMonth')} · {t('subscription.yearly')} : {t('subscription.priceYearly')}{t('subscription.perYear')} ({t('subscription.yearlyEquivalent')})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
