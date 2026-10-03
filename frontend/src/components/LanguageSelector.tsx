'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, getPathname } from '@/i18n/navigation';
import { IS_MOBILE_BUILD } from '@/lib/platform';
import { hardNavigate } from '@/lib/hard-navigate';
import { locales, type Locale } from '../../i18n/routing';

export const languageNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
};

export function LanguageSelector() {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    const target = newLocale as Locale;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (IS_MOBILE_BUILD) {
      // App (export statique, `localePrefix: 'always'`) : pas de middleware, la navigation client suffit.
      router.replace(`${pathname}${search}`, { locale: target });
      return;
    }
    // Web (`localePrefix: 'as-needed'`) : la locale par défaut n'a pas de préfixe, c'est le cookie
    // NEXT_LOCALE qui la départage côté middleware. Une navigation client vers `/` gardait l'ancien
    // cookie (ex. `en`) et donc le contenu anglais : on écrit le cookie puis on recharge la page cible.
    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=31536000; samesite=lax`;
    hardNavigate(`${getPathname({ href: pathname, locale: target })}${search}`);
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="captivia-language-select"
      aria-label={t('language')}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {languageNames[loc]}
        </option>
      ))}
    </select>
  );
}
