import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

/**
 * Zones privées : `/<locale>/xxx` couvre les locales préfixées (en, es, de, it, pt) et `/xxx` le français
 * (locale par défaut, sans préfixe). Les pages `noindex` de connexion/inscription restent
 * explorables pour que les robots lisent leur balise `noindex`.
 */
const PRIVATE_SEGMENTS = ['mes-animaux', 'parametres', 'animal-public'];

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...PRIVATE_SEGMENTS.flatMap((s) => [`/*/${s}`, `/${s}`])],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
