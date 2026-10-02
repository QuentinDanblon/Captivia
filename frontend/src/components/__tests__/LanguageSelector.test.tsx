import { render, screen, fireEvent } from '@testing-library/react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { LanguageSelector } from '../LanguageSelector';

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
}));

jest.mock('../../i18n', () => ({
  locales: ['fr', 'en', 'es', 'de', 'it', 'pt'],
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
    const replace = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(useLocale).mockReturnValue(locale);
    jest.mocked(usePathname).mockReturnValue(pathname);
    render(<LanguageSelector />);
    return { replace, select: screen.getByRole('combobox') };
  }

  it('calls router.replace(pathname, { locale }) when the language changes', () => {
    const { replace, select } = setup('fr', '/');
    fireEvent.change(select, { target: { value: 'en' } });
    expect(replace).toHaveBeenCalledWith('/', { locale: 'en' });
  });

  it('keeps the current pathname when switching locale', () => {
    const { replace, select } = setup('fr', '/mes-animaux');
    fireEvent.change(select, { target: { value: 'es' } });
    expect(replace).toHaveBeenCalledWith('/mes-animaux', { locale: 'es' });
  });

  it('switches back to fr from en (default locale) via replace(pathname, { locale: "fr" })', () => {
    const { replace, select } = setup('en', '/species/123');
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(replace).toHaveBeenCalledWith('/species/123', { locale: 'fr' });
  });

  it('preserves the query string', () => {
    window.history.pushState({}, '', '/mes-animaux?filter=cats');
    const { replace, select } = setup('en', '/mes-animaux');
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(replace).toHaveBeenCalledWith('/mes-animaux?filter=cats', { locale: 'fr' });
    window.history.pushState({}, '', '/');
  });
});
