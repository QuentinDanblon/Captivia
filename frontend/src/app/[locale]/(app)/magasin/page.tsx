'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';

interface AffiliateStore {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  categories: string[];
  types: string[];
}

// Les valeurs correspondent aux catégories stockées côté API (en français).
const CATEGORY_OPTIONS = [
  { value: '', labelKey: 'store.allCategories' },
  { value: 'mammifère', labelKey: 'store.categoryMammal' },
  { value: 'reptile', labelKey: 'store.categoryReptile' },
  { value: 'oiseau', labelKey: 'store.categoryBird' },
  { value: 'poisson', labelKey: 'store.categoryFish' },
  { value: 'amphibien', labelKey: 'store.categoryAmphibian' },
  { value: 'insecte', labelKey: 'store.categoryInsect' },
  { value: 'arachnide', labelKey: 'store.categoryArachnid' },
] as const;

function safeHref(url: string): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return trimmed.startsWith('http') ? trimmed : '#';
  }
}

export default function MagasinPage() {
  const t = useTranslations();
  const [stores, setStores] = useState<AffiliateStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getAffiliateStores(selectedCategory || undefined, undefined)
      .then((data) => {
        if (!cancelled) setStores(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('common.error'));
          setStores([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
            {t('store.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {t('store.subtitle')}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="store-category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('store.filterByCategory')}
          </label>
          <select
            id="store-category-filter"
            value={selectedCategory}
            onChange={(e) => {
              setLoading(true);
              setError(null);
              setSelectedCategory(e.target.value);
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" role="status">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent" aria-hidden="true" />
            <span className="sr-only">{t('common.loading')}</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-lg p-8 text-center text-red-700 dark:text-red-300">
            {t('common.error')} : {error}
          </div>
        ) : stores.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center text-gray-600 dark:text-gray-300">
            {t('common.noData')}
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {stores.map((store) => {
              const href = safeHref(store.url);
              return (
                <div
                  key={store.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-6 flex flex-col"
                >
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">
                    {store.name}
                  </h2>
                  {store.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1">
                      {store.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {store.types?.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                  {href !== '#' ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 transition-colors"
                    >
                      {t('store.visitStore')}
                      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('footer.amazonAssociate')}
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
            {t('store.disclaimer')}
          </p>
          <Link href="/transparency" className="text-sm text-emerald-700 dark:text-emerald-300 underline-offset-2 hover:underline mt-2 inline-block">
            {t('footer.transparency')}
          </Link>
        </div>
      </div>
    </div>
  );
}
