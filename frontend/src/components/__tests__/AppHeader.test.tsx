import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '../AppHeader';

jest.mock('@/i18n/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));

// La logique du sélecteur est testée à part : ici, un seul <select> doit être rendu.
jest.mock('@/components/LanguageSelector', () => ({
  LanguageSelector: () => <select aria-label="common.language" />,
}));

const mockedAuth = useAuth as jest.Mock;
const mockedPathname = usePathname as jest.Mock;
const logout = jest.fn();

function asGuest() {
  mockedAuth.mockReturnValue({ user: null, isLoading: false, logout });
}
function asUser() {
  mockedAuth.mockReturnValue({ user: { id: 'u1', email: 'smoke@captivia.test' }, isLoading: false, logout });
}

beforeEach(() => {
  logout.mockReset();
  mockedPathname.mockReturnValue('/');
});

describe('AppHeader', () => {
  it('invité : navigation publique, connexion / inscription, un seul sélecteur de langue', () => {
    asGuest();
    render(<AppHeader />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveAttribute('data-auth', 'guest');
    expect(banner).toHaveClass('noprint');

    const nav = screen.getByRole('navigation', { name: 'home.mainNavigation' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual(['nav.species', 'common.shop', 'nav.transparency']);

    expect(screen.getByRole('link', { name: 'common.login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'common.register' })).toHaveAttribute('href', '/register');
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'home.skipToContent' })).toHaveAttribute('href', '#main-content');
  });

  it('connecté : Mes animaux et Agenda (libellé court), compte et déconnexion', () => {
    asUser();
    render(<AppHeader />);
    expect(screen.getByRole('banner')).toHaveAttribute('data-auth', 'user');

    const nav = screen.getByRole('navigation', { name: 'home.mainNavigation' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual(['nav.species', 'common.shop', 'common.myAnimals', 'nav.agenda', 'nav.transparency']);

    const account = screen.getByRole('link', { name: 'common.settings' });
    expect(account).toHaveAttribute('href', '/parametres');
    expect(account).toHaveAttribute('title', 'smoke@captivia.test');

    fireEvent.click(screen.getByRole('button', { name: 'common.logout' }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'common.login' })).not.toBeInTheDocument();
  });

  it('session invité : Mes animaux, « Créer un compte » vers la conversion, pas de déconnexion', () => {
    mockedAuth.mockReturnValue({
      user: { id: 'g1', email: null, isGuest: true, locale: 'fr', isPremium: false },
      isLoading: false,
      logout,
    });
    render(<AppHeader />);
    const nav = screen.getByRole('navigation', { name: 'home.mainNavigation' });
    expect(within(nav).getByRole('link', { name: 'common.myAnimals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.createAccount' })).toHaveAttribute('href', '/sauvegarder');
    expect(screen.getByRole('link', { name: 'common.settings' })).toHaveAttribute('title', 'nav.guest');
    expect(screen.queryByRole('button', { name: 'common.logout' })).not.toBeInTheDocument();
  });

  it('page active : aria-current sur la rubrique (y compris ses sous-pages)', () => {
    asUser();
    mockedPathname.mockReturnValue('/mes-animaux/animal-1');
    render(<AppHeader />);
    const nav = screen.getByRole('navigation', { name: 'home.mainNavigation' });
    expect(within(nav).getByRole('link', { name: 'common.myAnimals' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'nav.species' })).not.toHaveAttribute('aria-current');
  });

  it('fiche espèce : la rubrique Espèces est active', () => {
    asGuest();
    mockedPathname.mockReturnValue('/species/2435099');
    render(<AppHeader />);
    const nav = screen.getByRole('navigation', { name: 'home.mainNavigation' });
    expect(within(nav).getByRole('link', { name: 'nav.species' })).toHaveAttribute('aria-current', 'page');
  });

  it('menu : ouverture en feuille modale, focus sur la première entrée, Échap referme et rend le focus', () => {
    asUser();
    render(<AppHeader />);
    const button = screen.getByRole('button', { name: 'home.openMenu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'home.mobileNavigation' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAccessibleName('home.closeMenu');
    expect(within(dialog).getAllByRole('link')[0]).toHaveFocus();
    expect(within(dialog).getByText('smoke@captivia.test')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'common.settings' })).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('menu invité : connexion et inscription ; un lien referme le menu', () => {
    asGuest();
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'home.openMenu' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'common.register' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('link', { name: 'common.shop' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pendant le chargement de session : ni compte ni connexion', () => {
    mockedAuth.mockReturnValue({ user: null, isLoading: true, logout });
    render(<AppHeader />);
    expect(screen.queryByRole('link', { name: 'common.login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'common.settings' })).not.toBeInTheDocument();
  });
});
