/**
 * Helpers SEO côté serveur (W4-04) : URL du site, URL localisées, hreflang et métadonnées de page.
 *
 * `localePrefix: 'as-needed'` (cf. i18n/routing.ts) : le français (locale par défaut) n'a pas de
 * préfixe (`/magasin`), les autres langues en ont un (`/en/magasin`). Les URL canoniques et les
 * hreflang suivent exactement ce schéma, sinon next-intl redirigerait (307) depuis `/fr/...`.
 */
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '../../i18n/routing';

export const DEFAULT_SITE_URL = 'https://captivia-app.netlify.app';
export const SITE_NAME = 'Captivia';

/** Locale OpenGraph (langue_PAYS) pour chaque locale de l'application. */
export const OG_LOCALES: Record<string, string> = {
  fr: 'fr_FR',
  en: 'en_GB',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
  pt: 'pt_PT',
};

/** Origine publique du site (sans slash final). `NEXT_PUBLIC_SITE_URL` ou valeur par défaut. */
export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    } catch {
      // valeur invalide : repli sur la valeur par défaut
    }
  }
  return DEFAULT_SITE_URL;
}

/**
 * Chemin localisé (relatif à l'origine) d'une page. `path` vaut '' pour l'accueil, sinon '/magasin'.
 */
export function localizedPath(locale: string, path: string): string {
  const clean = path === '/' ? '' : path;
  if (locale === routing.defaultLocale) return clean || '/';
  return `/${locale}${clean}`;
}

/** Table hreflang (chemins relatifs) des 6 locales + x-default (= langue par défaut). */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedPath(l, path);
  languages['x-default'] = localizedPath(routing.defaultLocale, path);
  return languages;
}

type PageMetadataInput = {
  locale: string;
  /** '' pour l'accueil, sinon '/magasin'. */
  path: string;
  /** Titre déjà traduit (sans le suffixe « · Captivia », ajouté par le template du layout racine). */
  title?: string;
  description?: string;
  /** Page privée ou sans intérêt pour les moteurs : `noindex, nofollow`. */
  noindex?: boolean;
};

/**
 * Métadonnées communes : canonical, hreflang, OpenGraph, Twitter, robots.
 * Le titre n'est renseigné que s'il est fourni (sinon c'est le titre par défaut du layout racine).
 */
export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  noindex,
}: PageMetadataInput): Metadata {
  const canonical = localizedPath(locale, path);
  const fullTitle = title ? `${title} · ${SITE_NAME}` : undefined;

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url: canonical,
      locale: OG_LOCALES[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
      ...(fullTitle ? { title: fullTitle } : {}),
      ...(description ? { description } : {}),
    },
    twitter: {
      card: 'summary',
      ...(fullTitle ? { title: fullTitle } : {}),
      ...(description ? { description } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

type SeoPageInput = {
  locale: string;
  path: string;
  /** Clé du namespace `seo` pour le titre. */
  titleKey: string;
  /** Clé du namespace `seo` pour la description (facultatif). */
  descriptionKey?: string;
  noindex?: boolean;
};

/** Métadonnées d'une page dont titre/description sont des clés du namespace `seo`. */
export async function seoPageMetadata({
  locale,
  path,
  titleKey,
  descriptionKey,
  noindex,
}: SeoPageInput): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    locale,
    path,
    title: t(titleKey),
    description: descriptionKey ? t(descriptionKey) : undefined,
    noindex,
  });
}
