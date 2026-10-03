'use client';

import { useTranslations, useLocale } from 'next-intl';
import { countryName } from '@/lib/country';
import type { SpeciesLegislationData } from './types';

export default function SpeciesLegislationTab({ speciesLegislation }: { speciesLegislation: SpeciesLegislationData | null }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div className="space-y-4">
      {speciesLegislation?.editorial && speciesLegislation.editorial.length > 0 ? (
        speciesLegislation.editorial.map((item) => (
          <div key={item.country} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-800 dark:text-white">
                {countryName(item.country, locale)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                item.status === 'allowed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                item.status === 'prohibited' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {item.status === 'allowed' ? t('species.allowed') : item.status === 'prohibited' ? t('species.prohibited') : t('species.permitRequired')}
              </span>
            </div>
            {item.details?.citesAppendix && (
              <p className="text-sm text-gray-700 dark:text-gray-300"><strong>CITES:</strong> {t('species.annex', { value: item.details.citesAppendix })}</p>
            )}
            {item.details?.euAnnex && (
              <p className="text-sm text-gray-700 dark:text-gray-300"><strong>{t('species.euAnnexLabel')}</strong> {item.details.euAnnex}</p>
            )}
            {item.details?.permits && item.details.permits.length > 0 && (
              <div className="text-sm mt-1">
                <strong>{t('species.permits')} :</strong>
                <ul className="list-disc list-inside mt-0.5">
                  {item.details.permits.map((permit: string, idx: number) => (
                    <li key={idx}>{permit}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.details?.restrictions && item.details.restrictions.length > 0 && (
              <div className="text-sm mt-1">
                <strong>{t('species.restrictions')} :</strong>
                <ul className="list-disc list-inside mt-0.5">
                  {item.details.restrictions.map((restriction: string, idx: number) => (
                    <li key={idx}>{restriction}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.sources && item.sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('species.sources')}</p>
                {item.sources.slice(0, 2).map((src: string, idx: number) => (
                  <a key={idx} href={src.startsWith('http') ? src : '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline break-all block">{src}</a>
                ))}
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="text-gray-500 dark:text-gray-400">{t('species.noLegalData')}</p>
      )}
    </div>
  );
}
