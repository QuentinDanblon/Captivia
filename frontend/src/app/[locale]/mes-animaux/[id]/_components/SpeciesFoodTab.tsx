'use client';

import { useTranslations } from 'next-intl';
import type { SpeciesFoodProduct } from './types';

export default function SpeciesFoodTab({ speciesFood }: { speciesFood: SpeciesFoodProduct[] }) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      {speciesFood && speciesFood.length > 0 ? (
        <div className="space-y-3">
          {speciesFood.slice(0, 5).map((food, idx: number) => (
            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
              <p className="font-semibold text-gray-800 dark:text-white">
                {food.product_name || food.name}
              </p>
              {food.brands && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{food.brands}</p>
              )}
              {food.categories && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{food.categories}</p>
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
