import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['fr', 'en', 'es', 'de', 'it', 'pt'],

  // Used when no locale matches
  defaultLocale: 'fr',
  
  // Web : 'as-needed' (pas de préfixe pour la locale par défaut, le middleware réécrit).
  // App mobile (export statique, sans middleware — W6-02) : 'always', chaque page vit sous /<locale>/.
  localePrefix: process.env.NEXT_PUBLIC_MOBILE_BUILD === '1' ? 'always' : 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

// Export individual values for convenience
export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
