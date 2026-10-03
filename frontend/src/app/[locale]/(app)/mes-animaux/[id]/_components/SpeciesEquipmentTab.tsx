'use client';

import { useTranslations } from 'next-intl';
import type { SpeciesEquipmentData } from './types';

export default function SpeciesEquipmentTab({ speciesEquipment }: { speciesEquipment: SpeciesEquipmentData | null }) {
  const t = useTranslations();
  const items = speciesEquipment?.recommendations ?? [];
  if (items.length === 0) return <p className="m-0 text-body text-ink-2">{t('common.noData')}</p>;
  return (
    <ul className="m-0 grid list-none divide-y divide-line p-0">
      {items.map((equipment, idx) => (
        <li key={idx} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5 first:pt-0 last:pb-0">
          <span className="font-medium text-ink">{equipment.label}</span>
          {equipment.category || equipment.size ? (
            <span className="text-ui text-ink-2">
              {equipment.category}
              {equipment.size ? <span className="font-mono"> · {equipment.size}</span> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
