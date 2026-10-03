'use client';

import { useTranslations } from 'next-intl';
import type { SpeciesHealthData } from './types';

export default function SpeciesHealthTab({ speciesHealth }: { speciesHealth: SpeciesHealthData | null }) {
  const t = useTranslations();
  const diseases = speciesHealth?.editorial?.diseases ?? [];
  if (diseases.length === 0) return <p className="m-0 text-body text-ink-2">{t('common.noData')}</p>;
  return (
    <ul className="m-0 grid list-none divide-y divide-line p-0">
      {diseases.map((disease, idx) => (
        <li key={idx} className="grid gap-1 py-3 first:pt-0 last:pb-0">
          <h3 className="m-0 font-sans text-body font-semibold text-ink">{disease.name}</h3>
          <dl className="m-0 grid gap-1 text-ui sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4">
            {disease.symptoms ? (
              <>
                <dt className="text-ink-2">{t('species.symptoms')}</dt>
                <dd className="m-0 text-ink">{disease.symptoms}</dd>
              </>
            ) : null}
            {disease.prevention ? (
              <>
                <dt className="text-ink-2">{t('species.prevention')}</dt>
                <dd className="m-0 text-ink">{disease.prevention}</dd>
              </>
            ) : null}
            {disease.whenToConsult ? (
              <>
                <dt className="text-ink-2">{t('species.whenToConsult')}</dt>
                <dd className="m-0 text-ink">{disease.whenToConsult}</dd>
              </>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}
