import { render, screen, waitFor, act } from '@testing-library/react';

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const apiMock: Record<string, jest.Mock> = {};
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    api: new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          apiMock[prop] ??= jest.fn(() => Promise.resolve([]));
          return apiMock[prop];
        },
      },
    ),
  };
});

const logout = jest.fn();
// Objet stable : comme dans l'app, `user` ne change pas d'identité à chaque rendu.
const mockSession = { user: { id: 'u1', isPremium: true }, token: 'tok', isLoading: false, logout };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockSession }));

const push = jest.fn();
jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ push, replace: jest.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

// Sections chargées à la demande : hors sujet ici.
jest.mock('next/dynamic', () => ({ __esModule: true, default: () => () => null }));
jest.mock('@/app/[locale]/(app)/mes-animaux/[id]/_components/FamilySection', () => ({
  __esModule: true,
  default: () => null,
}));

import { ApiError } from '@/lib/api';
import AnimalDetailPage from '../[locale]/(app)/mes-animaux/[id]/page';

const animal = (id: string, name: string, speciesId: number) => ({ id, name, speciesId, photos: [] });
const params = (id: string) => Promise.resolve({ locale: 'fr', id });

/** Revue frontend, constats 5 et 6 : fiche animal. */
describe('fiche animal', () => {
  beforeEach(() => {
    for (const k of Object.keys(apiMock)) delete apiMock[k];
    logout.mockReset();
    push.mockReset();
  });

  it('constat 6 : un 401 sur une section ne déconnecte pas (lib/api gère la session)', async () => {
    apiMock.getAnimal = jest.fn(() => Promise.resolve(animal('a1', 'Rango', 1)));
    apiMock.getSpecies = jest.fn(() => Promise.resolve({ scientificName: 'Pogona vitticeps' }));
    apiMock.getMedications = jest.fn(() => Promise.reject(new ApiError(401, 'Unauthorized')));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<AnimalDetailPage params={params('a1')} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Rango' })).toBeInTheDocument();
    const carnetLink = screen.getByRole('link', { name: 'carnetPrint.title' });
    expect(carnetLink.nextElementSibling).toHaveAccessibleName('animals.sheet.speciesGuide');
    expect(carnetLink.nextElementSibling).toHaveAttribute('href', '/species/1');
    await waitFor(() => expect(apiMock.getMedications).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith('/login');
    (console.error as jest.Mock).mockRestore();
  });

  it('constat 6 : un 403 sur la fiche affiche une erreur au lieu de déconnecter', async () => {
    apiMock.getAnimal = jest.fn(() => Promise.reject(new ApiError(403, 'Forbidden')));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<AnimalDetailPage params={params('a1')} />);

    expect(await screen.findByText('animals.errorLoadingAnimal')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    (console.error as jest.Mock).mockRestore();
  });

  it('constat 5 : une réponse tardive de l’animal précédent n’écrase pas la fiche courante', async () => {
    const slowA1 = deferred<unknown>();
    apiMock.getAnimal = jest.fn((id: string) =>
      id === 'a1' ? slowA1.promise : Promise.resolve(animal('a2', 'Nala', 2)),
    );
    apiMock.getSpecies = jest.fn((id: string) =>
      Promise.resolve({ scientificName: id === '1' ? 'Pogona vitticeps' : 'Python regius' }),
    );

    const { rerender } = render(<AnimalDetailPage params={params('a1')} />);
    await waitFor(() => expect(apiMock.getAnimal).toHaveBeenCalledWith('a1', 'tok'));
    rerender(<AnimalDetailPage params={params('a2')} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Nala' })).toBeInTheDocument();
    expect(await screen.findByText('Python regius')).toBeInTheDocument();

    await act(async () => {
      slowA1.resolve(animal('a1', 'Rango', 1));
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Nala' })).toBeInTheDocument();
    expect(screen.queryByText('Pogona vitticeps')).not.toBeInTheDocument();
    expect(apiMock.getSpecies).not.toHaveBeenCalledWith('1');
  });

  it('constat 5 : changer d’animal efface l’espèce de la fiche précédente', async () => {
    apiMock.getAnimal = jest.fn((id: string) =>
      Promise.resolve(id === 'a1' ? animal('a1', 'Rango', 1) : animal('a2', 'Nala', 2)),
    );
    apiMock.getSpecies = jest.fn((id: string) =>
      id === '1' ? Promise.resolve({ scientificName: 'Pogona vitticeps' }) : Promise.reject(new Error('down')),
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<AnimalDetailPage params={params('a1')} />);
    expect(await screen.findByText('Pogona vitticeps')).toBeInTheDocument();

    rerender(<AnimalDetailPage params={params('a2')} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Nala' })).toBeInTheDocument();
    await waitFor(() => expect(apiMock.getSpecies).toHaveBeenCalledWith('2'));
    expect(screen.queryByText('Pogona vitticeps')).not.toBeInTheDocument();
    (console.error as jest.Mock).mockRestore();
  });
});
