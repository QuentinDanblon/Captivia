'use client';

import { useTranslations } from 'next-intl';
import { Alert, ExternalLink } from '@/components/ui';

const SOURCES = [
  ['wallonia', 'https://bienetreanimal.wallonie.be/liste-positive'],
  ['flanders', 'https://www.vlaanderen.be/huisdierinfo/adopteren-en-verkoop/welke-zoogdieren-mag-je-houden'],
  ['brussels', 'https://environnement.brussels/citoyen/agir-pour-lenvironnement/veiller-au-bien-etre-animal/quel-animal-pouvez-vous-adopter-ou-detenir'],
  ['cites', 'https://www.health.belgium.be/fr/themes/animaux-vegetaux/cites-belgique/especes-protegees-cites'],
] as const;

/** Belgian legality varies by region and legal regime; legacy country-wide statuses are not reliable. */
export function BelgianLegalNotice() {
  const t = useTranslations('species.belgium');

  return (
    <Alert severity="info" title={t('title')}>
      <p className="m-0">{t('body')}</p>
      <ul className="m-0 grid list-disc gap-1 pl-5">
        {SOURCES.map(([key, href]) => (
          <li key={key}>
            <ExternalLink href={href} className="text-accent-text underline decoration-1 underline-offset-2">
              {t(`sources.${key}`)}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
