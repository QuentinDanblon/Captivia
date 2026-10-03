'use client';

import { useTranslations, useLocale } from 'next-intl';
import { countryName } from '@/lib/country';
import { Badge, ExternalLink } from '@/components/ui';
import type { SpeciesLegislationData } from './types';

export default function SpeciesLegislationTab({ speciesLegislation }: { speciesLegislation: SpeciesLegislationData | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const items = speciesLegislation?.editorial ?? [];
  if (items.length === 0) return <p className="m-0 text-body text-ink-2">{t('species.noLegalData')}</p>;

  return (
    <ul className="m-0 grid list-none divide-y divide-line p-0">
      {items.map((item) => (
        <li key={item.country} className="grid gap-2 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 font-sans text-body font-semibold text-ink">{countryName(item.country, locale)}</h3>
            <Badge tone={item.status === 'allowed' ? 'ok' : item.status === 'prohibited' ? 'danger' : 'warn'} dot>
              {item.status === 'allowed'
                ? t('species.allowed')
                : item.status === 'prohibited'
                  ? t('species.prohibited')
                  : t('species.permitRequired')}
            </Badge>
          </div>
          <dl className="m-0 grid gap-1 text-ui sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4">
            {item.details?.citesAppendix ? (
              <>
                <dt className="text-ink-2">CITES</dt>
                <dd className="m-0 font-mono text-ink">{t('species.annex', { value: item.details.citesAppendix })}</dd>
              </>
            ) : null}
            {item.details?.euAnnex ? (
              <>
                <dt className="text-ink-2">{t('species.euAnnexLabel')}</dt>
                <dd className="m-0 font-mono text-ink">{item.details.euAnnex}</dd>
              </>
            ) : null}
            {item.details?.permits && item.details.permits.length > 0 ? (
              <>
                <dt className="text-ink-2">{t('species.permits')}</dt>
                <dd className="m-0 text-ink">
                  <ul className="m-0 grid list-disc gap-0.5 pl-5">
                    {item.details.permits.map((permit, idx) => (
                      <li key={idx}>{permit}</li>
                    ))}
                  </ul>
                </dd>
              </>
            ) : null}
            {item.details?.restrictions && item.details.restrictions.length > 0 ? (
              <>
                <dt className="text-ink-2">{t('species.restrictions')}</dt>
                <dd className="m-0 text-ink">
                  <ul className="m-0 grid list-disc gap-0.5 pl-5">
                    {item.details.restrictions.map((restriction, idx) => (
                      <li key={idx}>{restriction}</li>
                    ))}
                  </ul>
                </dd>
              </>
            ) : null}
          </dl>
          {item.sources && item.sources.length > 0 ? (
            <p className="m-0 grid gap-0.5 border-t border-dotted border-line pt-2 font-mono text-meta text-ink-2">
              <span>{t('species.sources')}</span>
              {item.sources.slice(0, 2).map((src, idx) =>
                src.startsWith('http') ? (
                  <ExternalLink key={idx} href={src} className="break-all text-accent-text underline decoration-1 underline-offset-2">
                    {src}
                  </ExternalLink>
                ) : (
                  <span key={idx} className="break-all">
                    {src}
                  </span>
                ),
              )}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
