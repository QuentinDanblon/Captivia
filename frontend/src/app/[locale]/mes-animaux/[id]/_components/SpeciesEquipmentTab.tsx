'use client';

import { useTranslations } from 'next-intl';
import type { SpeciesEquipmentData } from './types';

export default function SpeciesEquipmentTab({ speciesEquipment }: { speciesEquipment: SpeciesEquipmentData | null }) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      {speciesEquipment?.recommendations && speciesEquipment.recommendations.length > 0 ? (
        <div className="space-y-3">
          {speciesEquipment.recommendations.map((equipment, idx: number) => (
            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
              <p className="font-semibold text-gray-800 dark:text-white">{equipment.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {equipment.category}
                {equipment.size && ` - ${equipment.size}`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">{t('common.noData')}</p>
      )}
    </div>
  );
}
