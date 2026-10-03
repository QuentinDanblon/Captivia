import { render, screen, within } from '@testing-library/react';

const getMyAnimals = jest.fn();
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  api: {
    getMyAnimals: (...args: unknown[]) => getMyAnimals(...args),
    searchSpecies: jest.fn(),
  },
}));

const logout = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', isPremium: true },
    token: 'tok',
    isLoading: false,
    logout,
  }),
}));

jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/mes-animaux/liste',
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import MyAnimalsPage from '../[locale]/(app)/mes-animaux/liste/page';

/** Revue frontend, constat 10 : plus de bouton ni de lien imbriqué dans le lien de la carte. */
describe('mes-animaux : cartes', () => {
  beforeEach(() => {
    getMyAnimals.mockReset().mockResolvedValue([
      { id: 'a1', name: 'Rango', speciesId: 1, photos: [] },
      { id: 'a2', name: 'Nala', speciesId: 2, photos: ['data:image/png;base64,xx'] },
    ]);
  });

  it('carte en <article> : lien étiré sur le nom, lien « carnet » frère, aucun élément interactif imbriqué', async () => {
    const { container } = render(<MyAnimalsPage />);

    const name = await screen.findByRole('link', { name: 'Rango' });
    expect(name).toHaveAttribute('href', '/mes-animaux/a1');
    expect(name.className).toContain('after:absolute');
    expect(name.className).toContain('after:inset-0');

    const card = name.closest('article')!;
    expect(card).not.toBeNull();
    expect(card.className).toContain('relative');

    const carnet = within(card).getByRole('link', { name: 'carnetPrint.title' });
    expect(carnet).toHaveAttribute('href', '/mes-animaux/a1/carnet');
    expect(carnet.className).toContain('relative');
    expect(carnet.className).toContain('z-10');

    const photo = within(card).getByRole('button', { name: 'animals.changePhoto' });
    expect(photo.className).toContain('z-10');

    // HTML valide : aucun <a> ou <button> à l'intérieur d'un autre <a> ou <button>.
    expect(container.querySelectorAll('a a, a button, button a, button button')).toHaveLength(0);
    expect(container.querySelectorAll('article')).toHaveLength(2);
    expect(logout).not.toHaveBeenCalled();
  });
});
