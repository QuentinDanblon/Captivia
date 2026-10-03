'use client';

import { useTranslations } from 'next-intl';
import type { SpeciesHealthData } from './types';

export default function SpeciesHealthTab({ speciesHealth }: { speciesHealth: SpeciesHealthData | null }) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      {speciesHealth?.editorial?.diseases && speciesHealth.editorial.diseases.length > 0 ? (
        <div className="space-y-4">
          {speciesHealth.editorial.diseases.map((disease, idx: number) => (
            <div key={idx}>
              <h3 className="font-semibold text-gray-800 dark:text-white">{disease.name}</h3>
              {disease.symptoms && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>{t('species.symptoms')}:</strong> {disease.symptoms}
                </p>
              )}
              {disease.prevention && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>{t('species.prevention')}:</strong> {disease.prevention}
                </p>
              )}
              {disease.whenToConsult && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>{t('species.whenToConsult')} :</strong> {disease.whenToConsult}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">{t('common.noData')}</p>
      )}
    </div>
  );
}
