'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { tokenStorage } from '@/lib/platform';

type ThemeChoice = 'system' | 'light' | 'dark';
const THEME_KEY = 'captivia.theme';

function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = dark ? '#121714' : '#f6f3ec';
  });
  window.dispatchEvent(new Event('captivia-theme-change'));
}

function saveTheme(choice: ThemeChoice) {
  tokenStorage.setItem(THEME_KEY, choice);
  applyTheme(choice);
}

const subscribeTheme = (callback: () => void) => {
  window.addEventListener('captivia-theme-change', callback);
  return () => window.removeEventListener('captivia-theme-change', callback);
};
const getDarkSnapshot = () => document.documentElement.dataset.theme === 'dark';
const getServerDarkSnapshot = () => false;

function useThemeChoice() {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  useEffect(() => {
    let activeChoice: ThemeChoice = 'system';
    let mounted = true;
    void tokenStorage.hydrate([THEME_KEY]).then(() => {
      if (!mounted) return;
      const saved = tokenStorage.getItem(THEME_KEY);
      activeChoice = saved === 'light' || saved === 'dark' ? saved : 'system';
      setChoice(activeChoice);
      applyTheme(activeChoice);
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateForSystem = () => { if (activeChoice === 'system') applyTheme('system'); };
    const updateChoice = () => {
      const saved = tokenStorage.getItem(THEME_KEY);
      activeChoice = saved === 'light' || saved === 'dark' ? saved : 'system';
      setChoice(activeChoice);
    };
    const updateFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      const saved = event.newValue;
      activeChoice = saved === 'light' || saved === 'dark' ? saved : 'system';
      setChoice(activeChoice);
      applyTheme(activeChoice);
    };
    media.addEventListener('change', updateForSystem);
    window.addEventListener('captivia-theme-change', updateChoice);
    window.addEventListener('storage', updateFromAnotherTab);
    return () => {
      mounted = false;
      media.removeEventListener('change', updateForSystem);
      window.removeEventListener('captivia-theme-change', updateChoice);
      window.removeEventListener('storage', updateFromAnotherTab);
    };
  }, []);
  const select = (value: ThemeChoice) => {
    setChoice(value);
    saveTheme(value);
  };
  return { choice, select };
}

/** Compact light/dark control for the two app shells and the marketing header. */
export function ThemeToggle() {
  const t = useTranslations('settings');
  const { select } = useThemeChoice();
  const isDark = useSyncExternalStore(subscribeTheme, getDarkSnapshot, getServerDarkSnapshot);
  return (
    <button
      type="button"
      aria-label={t('themeTitle')}
      aria-pressed={isDark}
      title={t('themeTitle')}
      onClick={() => select(isDark ? 'light' : 'dark')}
      className="theme-toggle"
    >
      {isDark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  );
}

export function ThemePreference() {
  const t = useTranslations('settings');
  const { choice, select } = useThemeChoice();

  return (
    <fieldset className="grid gap-3 border-0 p-0">
      <legend className="font-medium text-ink">{t('themeTitle')}</legend>
      <p className="m-0 text-ui text-ink-2">{t('themeDescription')}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('themeTitle')}>
        {(['system', 'light', 'dark'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={choice === value}
            onClick={() => select(value)}
            className="min-h-11 border border-line-strong bg-surface px-4 text-ui text-ink transition-colors hover:border-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-pressed:border-accent aria-pressed:bg-accent-soft"
          >
            {value === 'system' ? t('themeSystem') : value === 'light' ? t('themeLight') : t('themeDark')}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
