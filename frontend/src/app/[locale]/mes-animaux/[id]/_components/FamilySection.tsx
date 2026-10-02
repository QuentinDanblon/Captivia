'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Animal } from '@/lib/api';

/** Famille & groupe (module F) : parents, groupe et petits. */
export default function FamilySection({ animal, offspring }: { animal: Animal; offspring: Animal[] }) {
  const t = useTranslations();
  if (!(animal.father || animal.mother || animal.groupName || offspring.length > 0)) return null;
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 min-w-0">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {t('animals.family.title')}
        </h2>
        <div className="flex flex-wrap gap-3">
          {animal.father && (
            <Link
              href={`/mes-animaux/${animal.father.id}`}
              className="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-3 py-2 hover:border-emerald-500 transition-colors"
            >
              {animal.father.photos?.[0] ? (
                <img src={animal.father.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                  {animal.father.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm text-gray-800 dark:text-gray-200">
                <span className="font-medium">{t('animals.family.father')} :</span> {animal.father.name}
              </span>
            </Link>
          )}
          {animal.mother && (
            <Link
              href={`/mes-animaux/${animal.mother.id}`}
              className="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-3 py-2 hover:border-emerald-500 transition-colors"
            >
              {animal.mother.photos?.[0] ? (
                <img src={animal.mother.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                  {animal.mother.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm text-gray-800 dark:text-gray-200">
                <span className="font-medium">{t('animals.family.mother')} :</span> {animal.mother.name}
              </span>
            </Link>
          )}
          {animal.groupName && (
            <span className="px-3 py-2 rounded-xl bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 text-sm font-medium inline-flex items-center gap-1.5">
              {t('animals.family.group')} : {animal.groupName}
            </span>
          )}
        </div>
        {offspring.length > 0 && (
          <div className="mt-5">
            <h3 className="text-base font-semibold mb-3 text-gray-800 dark:text-white">
              {t('animals.family.offspring')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {offspring.map((kid) => (
                <Link
                  key={kid.id}
                  href={`/mes-animaux/${kid.id}`}
                  className="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-3 py-2 hover:border-emerald-500 transition-colors"
                >
                  {kid.photos?.[0] ? (
                    <img src={kid.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                      {kid.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{kid.name}</p>
                    {kid.sex && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t(`animals.${kid.sex}`)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
