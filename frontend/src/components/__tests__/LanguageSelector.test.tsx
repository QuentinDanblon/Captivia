import { render, screen, fireEvent } from '@testing-library/react';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { hardNavigate } from '@/lib/hard-navigate';
import { LanguageSelector } from '../LanguageSelector';

jest.mock('@/lib/hard-navigate', () => ({ hardNavigate: jest.fn() }));
jest.mock('@/lib/platform', () => ({ IS_MOBILE_BUILD: false }));

// Mock next-intl/routing (ESM) so i18n/routing can load
jest.mock('next-intl/routing', () => ({
  defineRouting: (config: { locales: string[] }) => ({
    ...config,
    localePrefix: { mode: 'as-needed' },
    defaultLocale: config.locales[0],
  }),
}));

jest.mock('next-intl', () => ({
  useLocale: jest.fn(() => 'fr'),
  useTranslations: jest.fn(() => (key: string) => key),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  // as-needed : pas de préfixe pour la locale par défaut (fr).
  getPathname: jest.fn(({ href, locale }: { href: string; locale: string }) =>
    locale === 'fr' ? href : `/${locale}${href === '/' ? '' : href}`,
  ),
}));

describe('LanguageSelector', () => {
  it('should render language selector', () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox', { name: /language/i });
    expect(select).toBeInTheDocument();
  });

  it('should display current locale', () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('fr');
  });

  it('should display all 6 language options', () => {
    render(<LanguageSelector />);
    
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    
    const languages = ['Français', 'English', 'Español', 'Deutsch', 'Italiano', 'Português'];
    languages.forEach((lang) => {
      expect(screen.getByText(lang)).toBeInTheDocument();
    });
  });

  beforeEach(() => {
    jest.mocked(useLocale).mockReturnValue('fr');
    jest.mocked(usePathname).mockReturnValue('/');
  });

  function setup(locale: string, pathname: string) {
    jest.mocked(hardNavigate).mockClear();
    jest.mocked(useLocale).mockReturnValue(locale);
    jest.mocked(usePathname).mockReturnValue(pathname);
    render(<LanguageSelector />);
    return { select: screen.getByRole('combobox') };
  }

  it('écrit le cookie NEXT_LOCALE puis recharge la page dans la nouvelle langue', () => {
    const { select } = setup('fr', '/');
    fireEvent.change(select, { target: { value: 'en' } });
    expect(document.cookie).toContain('NEXT_LOCALE=en');
    expect(hardNavigate).toHaveBeenCalledWith('/en');
  });

  it('conserve le chemin courant', () => {
    const { select } = setup('fr', '/mes-animaux');
    fireEvent.change(select, { target: { value: 'es' } });
    expect(hardNavigate).toHaveBeenCalledWith('/es/mes-animaux');
  });

  it('revient à fr (locale par défaut, sans préfixe) en mettant à jour le cookie', () => {
    const { select } = setup('en', '/species/123');
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(document.cookie).toContain('NEXT_LOCALE=fr');
    expect(hardNavigate).toHaveBeenCalledWith('/species/123');
  });

  it('conserve la query string', () => {
    window.history.pushState({}, '', '/mes-animaux?filter=cats');
    const { select } = setup('en', '/mes-animaux');
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(hardNavigate).toHaveBeenCalledWith('/mes-animaux?filter=cats');
    window.history.pushState({}, '', '/');
  });
});
