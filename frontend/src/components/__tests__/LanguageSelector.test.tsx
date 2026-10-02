import { render, screen, fireEvent } from '@testing-library/react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
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

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
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

  it('should call router.push when language changes', () => {
    const mockPush = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });
    
    expect(mockPush).toHaveBeenCalledWith('/en/');
  });

  it('should handle locale change from fr to en', () => {
    const mockPush = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    
    jest.mocked(usePathname).mockReturnValue('/mes-animaux');
    
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });
    
    expect(mockPush).toHaveBeenCalledWith('/en/mes-animaux');
  });

  it('should remove locale prefix when changing to fr (default locale)', () => {
    const mockPush = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    
    jest.mocked(useLocale).mockReturnValue('en');
    
    jest.mocked(usePathname).mockReturnValue('/en/species/123');
    
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fr' } });
    
    expect(mockPush).toHaveBeenCalledWith('/species/123');
  });

  it('should preserve pathname structure when changing language', () => {
    const mockPush = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    
    jest.mocked(usePathname).mockReturnValue('/fr/species/123');
    
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'es' } });
    
    expect(mockPush).toHaveBeenCalledWith('/es/species/123');
  });
});
