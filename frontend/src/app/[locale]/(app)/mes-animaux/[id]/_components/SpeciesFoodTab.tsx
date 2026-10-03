'use client';

import { useTranslations } from 'next-intl';
import type { SpeciesFoodProduct } from './types';

export default function SpeciesFoodTab({ speciesFood }: { speciesFood: SpeciesFoodProduct[] }) {
  const t = useTranslations();
  if (!speciesFood || speciesFood.length === 0) return <p className="m-0 text-body text-ink-2">{t('common.noData')}</p>;
  return (
    <ul className="m-0 grid list-none divide-y divide-line p-0">
      {speciesFood.slice(0, 5).map((food, idx) => (
        <li key={idx} className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0">
          <span className="font-medium text-ink">{food.product_name || food.name}</span>
          {food.brands ? <span className="text-ui text-ink-2">{food.brands}</span> : null}
          {food.categories ? <span className="line-clamp-1 text-meta text-ink-2">{food.categories}</span> : null}
        </li>
      ))}
    </ul>
  );
}
