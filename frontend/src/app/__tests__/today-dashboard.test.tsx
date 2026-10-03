import { render, screen, within } from '@testing-library/react';

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

const fetchAgenda = jest.fn();
jest.mock('@/lib/agenda', () => ({
  ...jest.requireActual('@/lib/agenda'),
  fetchAgenda: (...args: unknown[]) => fetchAgenda(...args),
}));

const logout = jest.fn();
let mockSession: { user: Record<string, unknown> | null; token: string | null; isLoading: boolean; logout: jest.Mock } = {
  user: { id: 'u1', isPremium: false },
  token: 'tok',
  isLoading: false,
  logout,
};
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockSession }));

jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/mes-animaux',
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { ApiError } from '@/lib/api';
import { localDayKey } from '@/lib/dates';
import TodayPage from '../[locale]/(app)/mes-animaux/page';

const today = new Date();
const at = (hour: number, offset = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/** Tableau de bord « Aujourd'hui » : page d'entrée de l'app (onglet « Mes animaux »). */
describe('tableau de bord « Aujourd’hui »', () => {
  beforeEach(() => {
    for (const k of Object.keys(apiMock)) delete apiMock[k];
    fetchAgenda.mockReset().mockResolvedValue({ from: '', to: '', truncated: false, items: [] });
    logout.mockReset();
    mockSession = { user: { id: 'u1', isPremium: false }, token: 'tok', isLoading: false, logout };
  });

  it('sans animal : le parcours du premier animal en trois étapes', async () => {
    apiMock.getMyAnimals = jest.fn(() => Promise.resolve([]));
    render(<TodayPage />);

    expect(await screen.findByRole('heading', { level: 2, name: 'onboarding.title' })).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'onboarding.stepsLabel' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled();
  });

  it('un animal : agenda des 8 jours, frise, alertes, carte et emplacement verrouillé (compte gratuit)', async () => {
    apiMock.getMyAnimals = jest.fn(() => Promise.resolve([{ id: 'a1', name: 'Kaa', speciesId: 7, photos: [] }]));
    apiMock.getVaccinations = jest.fn(() =>
      Promise.resolve([{ id: 'v1', name: 'Rage', date: '2025-01-01T00:00:00.000Z', nextDueDate: at(12, -2).toISOString() }]),
    );
    apiMock.getSpecies = jest.fn(() => Promise.resolve({ scientificName: 'Boa constrictor Linnaeus, 1758', class: 'Reptilia' }));
    fetchAgenda.mockResolvedValue({
      from: '',
      to: '',
      truncated: false,
      items: [
        {
          id: 'i1', date: at(23).toISOString(), day: localDayKey(today), allDay: false, type: 'routine',
          animalId: 'a1', animalName: 'Kaa', title: 'Nourrissage', detail: null, status: 'pending', sourceId: 'r1',
        },
      ],
    });

    render(<TodayPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'today.title' })).toBeInTheDocument();
    const [, from, to] = fetchAgenda.mock.calls[0];
    expect(from).toBe(localDayKey(today));
    expect(to).toBe(localDayKey(at(12, 7)));

    const timeline = await screen.findByRole('list', { name: 'today.timelineLabel' });
    expect(within(timeline).getByText('Nourrissage')).toBeInTheDocument();
    expect(within(timeline).getByText('today.status.due')).toBeInTheDocument();

    expect(await screen.findByText('today.alerts.vaccineOverdue.title')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-severity', 'urgent');

    const name = screen.getByRole('link', { name: 'Kaa' });
    expect(name).toHaveAttribute('href', '/mes-animaux/a1');
    expect(name.closest('article')).not.toBeNull();
    expect(await screen.findByText('Boa constrictor')).toBeInTheDocument();
    // Gratuit, limite atteinte : pas de bouton d'ajout, l'emplacement verrouillé mène à Premium.
    expect(screen.queryByRole('button', { name: 'animals.addAnimal' })).not.toBeInTheDocument();
    expect(screen.getByText('lockedTitle')).toBeInTheDocument(); // espace de noms « guest »
  });

  it('échec de l’agenda : la frise propose de réessayer, le reste s’affiche', async () => {
    apiMock.getMyAnimals = jest.fn(() => Promise.resolve([{ id: 'a1', name: 'Kaa', speciesId: 7, photos: [] }]));
    fetchAgenda.mockRejectedValue(new Error('network'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodayPage />);

    expect(await screen.findByText('today.agendaError')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kaa' })).toBeInTheDocument();
    (console.error as jest.Mock).mockRestore();
  });

  it('un 401 au chargement ne déconnecte pas (lib/api gère la session)', async () => {
    apiMock.getMyAnimals = jest.fn(() => Promise.reject(new ApiError(401, 'Unauthorized')));
    render(<TodayPage />);

    expect(await screen.findByText('today.loadError')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('sans session : l’accueil invité, aucun appel à l’API', () => {
    mockSession = { user: null, token: null, isLoading: false, logout };
    render(<TodayPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'entryTitle' })).toBeInTheDocument();
    expect(apiMock.getMyAnimals).toBeUndefined();
    expect(fetchAgenda).not.toHaveBeenCalled();
  });
});
