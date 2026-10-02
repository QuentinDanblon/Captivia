'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api, type PublicAnimalProfile } from '@/lib/api';
import { Link } from '@/i18n/navigation';

export default function AnimalPublicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<PublicAnimalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    api
      .getPublicAnimal(slug)
      .then(setData)
      .catch((e: Error & { status?: number }) =>
        // 404 : lien inexistant, désactivé ou régénéré — message générique, sans détail
        setError(e.status === 404 ? t('publicLink.pageNotFound') : e.message || t('publicLink.pageNotFound')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString(locale);
    } catch {
      return dateString;
    }
  };

  if (loading || !slug) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4" />
          <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            {error || t('publicLink.pageNotFound')}
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            {t('common.home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Photo + name */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold shrink-0 overflow-hidden ring-2 ring-white/30">
                {data.photo ? (
                  <img src={data.photo} alt={data.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  data.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">{data.name}</h1>
                {data.species && (
                  <p className="text-white/90 text-sm">
                    {data.species.commonName}
                    {data.species.scientificName ? ` (${data.species.scientificName})` : ''}
                  </p>
                )}
                {data.birthYear && (
                  <p className="text-white/90 text-sm">{t('publicLink.bornIn', { year: data.birthYear })}</p>
                )}
                {data.sex && (
                  <p className="text-white/90 text-sm">
                    {t('animals.sex')}: {data.sex === 'male' ? t('animals.male') : data.sex === 'female' ? t('animals.female') : t('animals.unknown')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Vaccinations : uniquement si le propriétaire a choisi de les afficher */}
          {data.vaccinations && (
            <div className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t('publicLink.vaccinations')}</h2>
              {data.vaccinations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('publicLink.noVaccinations')}</p>
              ) : (
                <ul className="space-y-3">
                  {data.vaccinations.map((v, i) => (
                    <li
                      key={`${v.name}-${v.date}-${i}`}
                      className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <p className="font-medium text-gray-800 dark:text-white">{v.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(v.date)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          {t('common.appName')} — {t('publicLink.readOnly')}
        </p>
      </div>
    </div>
  );
}
