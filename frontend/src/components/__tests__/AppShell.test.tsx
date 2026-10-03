import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell, APP_DESTINATIONS } from '../AppShell';

jest.mock('@/i18n/navigation', () => ({
  usePathname: jest.fn(() => '/agenda'),
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
let mockAvailability: 'unknown' | 'available' | 'unavailable' = 'unknown';
jest.mock('@/components/community/useCommunityAvailability', () => ({
  useCommunityAvailability: () => mockAvailability,
}));

const mockedAuth = useAuth as jest.Mock;
const logout = jest.fn();

beforeEach(() => {
  mockAvailability = 'unknown';
  (usePathname as jest.Mock).mockReturnValue('/agenda');
  logout.mockReset();
});

describe('AppShell', () => {
  it('4 destinations (≤ 5) en onglets mobiles et dans le rail, contenu dans <main>', () => {
    mockedAuth.mockReturnValue({ user: { email: 'smoke@captivia.test' }, isLoading: false, logout });
    render(
      <AppShell>
        <h1>Agenda</h1>
      </AppShell>,
    );
    expect(APP_DESTINATIONS.length).toBeLessThanOrEqual(5);
    // Communauté : « bientôt » tant que l'API n'a pas confirmé le volet (sonde, src/lib/community.ts).
    const open = APP_DESTINATIONS.filter((d) => !d.soon && !d.feature).length;
    const tabbar = screen.getByRole('navigation', { name: 'home.mobileNavigation' });
    expect(within(tabbar).getAllByRole('listitem')).toHaveLength(APP_DESTINATIONS.length);
    expect(within(tabbar).getAllByRole('link')).toHaveLength(open);
    const rail = screen.getByRole('navigation', { name: 'home.mainNavigation' });
    expect(within(rail).getAllByRole('link')).toHaveLength(open);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
  });

  it('Communauté réservée : « bientôt », désactivée, sans lien mort', () => {
    mockedAuth.mockReturnValue({ user: null, isLoading: false, logout });
    render(<AppShell>…</AppShell>);
    const tabbar = screen.getByRole('navigation', { name: 'home.mobileNavigation' });
    const community = within(tabbar).getByText('nav.community').parentElement!;
    expect(community.tagName).toBe('SPAN');
    expect(community).toHaveAttribute('aria-disabled', 'true');
    expect(community).toHaveTextContent('nav.soon');
    expect(screen.queryByRole('link', { name: /nav\.community/ })).not.toBeInTheDocument();
  });

  it('destination active marquée aria-current (onglet et rail)', () => {
    mockedAuth.mockReturnValue({ user: { email: 'a@b.c' }, isLoading: false, logout });
    render(<AppShell>…</AppShell>);
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(2);
    current.forEach((link) => expect(link).toHaveAttribute('href', '/agenda'));
  });

  it('Espèces : mène à la recherche de l\'app et reste active sur une fiche', () => {
    mockedAuth.mockReturnValue({ user: null, isLoading: false, logout });
    (usePathname as jest.Mock).mockReturnValue('/species/2435099');
    render(<AppShell>…</AppShell>);
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(2);
    current.forEach((link) => {
      expect(link).toHaveAttribute('href', '/especes');
      expect(link).toHaveTextContent('nav.species');
    });
  });

  it('connecté : profil (e-mail) et déconnexion', () => {
    mockedAuth.mockReturnValue({ user: { email: 'smoke@captivia.test' }, isLoading: false, logout });
    render(<AppShell>…</AppShell>);
    expect(screen.getByText('smoke@captivia.test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.logout' }));
    expect(logout).toHaveBeenCalled();
    expect(screen.queryByText('nav.guest')).not.toBeInTheDocument();
  });

  it('mode invité : « Invité · Créer un compte » à la place du profil', () => {
    mockedAuth.mockReturnValue({ user: null, isLoading: false, logout });
    render(<AppShell>…</AppShell>);
    expect(screen.getByText('nav.guest')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: 'nav.createAccount' });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/register'));
    expect(screen.queryByRole('button', { name: 'common.logout' })).not.toBeInTheDocument();
  });

  it('session invité (sans e-mail) : « Invité · Créer un compte » vers la conversion, jamais de déconnexion', () => {
    mockedAuth.mockReturnValue({
      user: { id: 'g1', email: null, isGuest: true, locale: 'fr', isPremium: false },
      isLoading: false,
      logout,
    });
    render(<AppShell>…</AppShell>);
    expect(screen.getByText('nav.guest')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: 'nav.createAccount' });
    expect(ctas.length).toBeGreaterThanOrEqual(2); // rail + barre haute
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/sauvegarder'));
    expect(screen.queryByRole('button', { name: 'common.logout' })).not.toBeInTheDocument();
  });

  it.each(['unknown', 'unavailable'] as const)('Communauté « %s » : toujours « bientôt », sans lien', (state) => {
    mockAvailability = state;
    mockedAuth.mockReturnValue({ user: { email: 'a@b.c' }, isLoading: false, logout });
    render(<AppShell>…</AppShell>);
    expect(screen.queryByRole('link', { name: /nav\.community/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('nav.soon').length).toBeGreaterThan(0);
  });

  it("Communauté ouverte (l'API répond) : vrai lien, actif sous /communaute", () => {
    mockAvailability = 'available';
    (usePathname as jest.Mock).mockReturnValue('/communaute/publication/abc');
    mockedAuth.mockReturnValue({ user: { email: 'a@b.c' }, isLoading: false, logout });
    render(<AppShell>…</AppShell>);
    const links = screen.getAllByRole('link', { name: 'nav.community' });
    expect(links).toHaveLength(2); // onglet + rail
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/communaute');
      expect(link).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.queryByText('nav.soon')).not.toBeInTheDocument();
  });
});
