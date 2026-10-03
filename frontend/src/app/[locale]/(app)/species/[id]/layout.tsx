import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '../../../../../../i18n/routing';
import { API_URL } from '@/lib/config';
import { buildPageMetadata, getSiteUrl, localizedPath } from '@/lib/seo';

type Props = { children: ReactNode; params: Promise<{ locale: string; id: string }> };

/** Délai maximal accordé à l'API pour les métadonnées : au-delà, repli générique. */
const FETCH_TIMEOUT_MS = 3000;
/** Les fiches changent rarement : cache de données Next.js de 24 h. */
const REVALIDATE_SECONDS = 86400;

type SpeciesLookup =
  | { found: true; commonName?: string; scientificName?: string; rank?: string }
  | { found: false; missing: boolean };

/**
 * Nom de l'espèce via l'API publique GET /species/:id ; ne lève jamais d'exception.
 * `cache` : un seul appel par requête pour les métadonnées et le JSON-LD.
 */
const fetchSpeciesNames = cache(async (id: string): Promise<SpeciesLookup> => {
  if (!/^\d+$/.test(id)) return { found: false, missing: true };
  try {
    const res = await fetch(`${API_URL}/species/${id}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return { found: false, missing: true };
    if (!res.ok) return { found: false, missing: false };
    const data = (await res.json()) as {
      scientificName?: unknown;
      canonicalName?: unknown;
      rank?: unknown;
      profile?: { commonNameFr?: unknown; scientificName?: unknown };
    };
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    return {
      found: true,
      commonName: str(data.profile?.commonNameFr),
      scientificName: str(data.profile?.scientificName) ?? str(data.canonicalName) ?? str(data.scientificName),
      rank: str(data.rank),
    };
  } catch {
    return { found: false, missing: false };
  }
});

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  const path = `/species/${encodeURIComponent(id)}`;
  const species = await fetchSpeciesNames(id);

  if (!species.found) {
    return buildPageMetadata({
      locale,
      path,
      title: t('speciesTitle'),
      description: t('speciesFallbackDescription'),
      // Fiche inexistante : ne pas indexer. Erreur transitoire de l'API : on laisse indexable.
      noindex: species.missing,
    });
  }

  // Le nom vernaculaire de l'API est en français : on ne l'affiche que pour la locale française.
  const { commonName, scientificName } = species;
  const name =
    locale === 'fr' && commonName && scientificName && commonName !== scientificName
      ? `${commonName} (${scientificName})`
      : ((locale === 'fr' ? commonName : undefined) ?? scientificName ?? commonName);

  return buildPageMetadata({
    locale,
    path,
    title: name ?? t('speciesTitle'),
    description: name ? t('speciesDescription', { name }) : t('speciesFallbackDescription'),
  });
}

/** Données structurées schema.org `Taxon` (nom scientifique, nom commun, rang, fiche GBIF). */
function TaxonJsonLd({ locale, id, species }: { locale: string; id: string; species: Extract<SpeciesLookup, { found: true }> }) {
  if (!species.scientificName) return null;
  const gbif = Number(id) < 2_000_000_001;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Taxon',
    name: species.scientificName,
    ...(locale === 'fr' && species.commonName ? { alternateName: species.commonName } : {}),
    ...(species.rank ? { taxonRank: species.rank.toLowerCase() } : {}),
    url: `${getSiteUrl()}${localizedPath(locale, `/species/${id}`)}`,
    ...(gbif ? { sameAs: `https://www.gbif.org/species/${id}` } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // JSON sérialisé : « < » échappé pour qu'aucune valeur ne puisse fermer la balise <script>.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export default async function SpeciesLayout({ children, params }: Props) {
  const { locale, id } = await params;
  const species = hasLocale(routing.locales, locale) ? await fetchSpeciesNames(id) : null;
  return (
    <>
      {species?.found ? <TaxonJsonLd locale={locale} id={id} species={species} /> : null}
      {children}
    </>
  );
}
