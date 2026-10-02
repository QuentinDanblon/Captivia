'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function AbonnementPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, token, isLoading: authLoading, setUser } = useAuth();
  const [status, setStatus] = useState<{ isPremium: boolean } | null>(null);
  const [submitting, setSubmitting] = useState<'monthly' | 'yearly' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) {
      api.getSubscription(token).then((d) => setStatus({ isPremium: d.isPremium })).catch(() => setStatus({ isPremium: false }));
    }
  }, [token]);

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    if (!token) return;
    setSubmitting(plan);
    setMessage(null);
    try {
      await api.subscribe(plan, token);
      setStatus({ isPremium: true });
      setUser?.((prev) => (prev ? { ...prev, isPremium: true } : prev));
      setMessage({ type: 'success', text: t('subscription.subscribeSuccess') });
    } catch {
      setMessage({ type: 'error', text: t('subscription.subscribeError') });
    } finally {
      setSubmitting(null);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <Link href="/parametres" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-6">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('common.back')} {t('common.settings')}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">{t('subscription.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{t('subscription.subtitle')}</p>
        {status?.isPremium && (
          <div className="mb-8 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
            {t('subscription.currentPlan')}
          </div>
        )}
        {message && (
          <div className={`mb-6 p-4 rounded-2xl border-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'}`}>
            {message.text}
          </div>
        )}
        <ul className="mb-8 space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2"><span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>{t('subscription.benefitAnimals')}</li>
          <li className="flex items-start gap-2"><span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>{t('subscription.benefitHealth')}</li>
          <li className="flex items-start gap-2"><span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>{t('subscription.benefitQR')}</li>
        </ul>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{t('subscription.monthly')}</h2>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-4">{t('subscription.priceMonthly')}<span className="text-base font-normal text-gray-500 dark:text-gray-400">{t('subscription.perMonth')}</span></p>
            <button type="button" onClick={() => handleSubscribe('monthly')} disabled={!!status?.isPremium || submitting !== null} className="mt-auto w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {submitting === 'monthly' ? t('common.loading') : t('subscription.chooseMonthly')}
            </button>
          </div>
          <div className="rounded-2xl border-2 border-emerald-500 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 p-6 flex flex-col relative">
            <span className="absolute top-4 right-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 rounded">{t('subscription.yearlyDiscount')}</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{t('subscription.yearly')}</h2>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-4">{t('subscription.priceYearly')}<span className="text-base font-normal text-gray-500 dark:text-gray-400">{t('subscription.perYear')}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('subscription.yearlyEquivalent')}</p>
            <button type="button" onClick={() => handleSubscribe('yearly')} disabled={!!status?.isPremium || submitting !== null} className="mt-auto w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {submitting === 'yearly' ? t('common.loading') : t('subscription.chooseYearly')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
