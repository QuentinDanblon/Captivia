import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import GuidesPage from '../[locale]/(app)/guides/page';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({ useSearchParams: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: { getSpecies: jest.fn(), getRecommendedEquipment: jest.fn(), getMyAnimals: jest.fn(), searchSpecies: jest.fn() } }));
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => <a {...props}>{children}</a>,
}));

const mocked = api as jest.Mocked<typeof api>;
const species = { scientificName: 'Boa constrictor', class: 'Reptilia', profile: { commonNameFr: 'Boa constricteur' } };

beforeEach(() => {
  jest.clearAllMocks();
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('species=1'));
  (useAuth as jest.Mock).mockReturnValue({ token: null });
  mocked.getSpecies.mockResolvedValue(species);
  mocked.getRecommendedEquipment.mockResolvedValue({ recommendations: [], sources: [] });
});

it('ne publie pas une dimension sans source et garde les paramètres inconnus explicitement absents', async () => {
  mocked.getSpecies.mockResolvedValue({ ...species, habitat: { minSpaceSize: '999 × 999 cm', tempMin: 123 } });
  render(<GuidesPage />);
  expect(await screen.findByText('guides.noHabitat')).toBeInTheDocument();
  expect(screen.getByText('guides.noDimensions')).toBeInTheDocument();
  expect(screen.queryByText('999 × 999 cm')).not.toBeInTheDocument();
});

it('affiche les exigences propres à l’espèce avec leurs sources', async () => {
  mocked.getSpecies.mockResolvedValue({ ...species, habitat: { minSpaceSize: '200 × 100 × 100 cm', sources: [{ title: 'Source', url: 'https://www.rspca.org.uk/example' }] } });
  render(<GuidesPage />);
  expect(await screen.findByText('200 × 100 × 100 cm')).toBeInTheDocument();
  expect(screen.queryByText('guides.noDimensions')).not.toBeInTheDocument();
});

it('une réponse périmée ne remplace pas le guide de la dernière espèce choisie', async () => {
  let resolveFirst!: (value: unknown) => void;
  mocked.getSpecies.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
  const { rerender } = render(<GuidesPage />);
  await waitFor(() => expect(mocked.getSpecies).toHaveBeenCalledWith('1'));
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('species=2'));
  mocked.getSpecies.mockResolvedValueOnce({ scientificName: 'Felis catus', class: 'Mammalia', profile: { commonNameFr: 'Chat' } });
  rerender(<GuidesPage />);
  expect(await screen.findByRole('heading', { name: 'Chat' })).toBeInTheDocument();
  await act(async () => { resolveFirst(species); });
  expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Boa constricteur' })).not.toBeInTheDocument();
});

it('les deux animaux d’une même espèce restent sélectionnables séparément', async () => {
  (useAuth as jest.Mock).mockReturnValue({ token: 'test-token' });
  mocked.getMyAnimals.mockResolvedValue([{ id: 'boa-1', name: 'Kaa', speciesId: 1 }, { id: 'boa-2', name: 'Luna', speciesId: 1 }]);
  render(<GuidesPage />);
  await screen.findByRole('option', { name: 'Luna' });
  fireEvent.change(screen.getByRole('combobox', { name: 'guides.myAnimals' }), { target: { value: 'boa-2' } });
  expect(mockReplace).toHaveBeenLastCalledWith('/guides?species=1&animal=boa-2');
});

it('un poisson demande un choix de milieu et conserve son identité lors du changement', async () => {
  mocked.getSpecies.mockResolvedValue({ scientificName: 'Unknown fish', class: 'Actinopterygii' });
  render(<GuidesPage />);
  expect(await screen.findByText('guides.chooseWater')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'guides.categories.freshwater.title' })).toHaveAttribute('href', '/guides?category=freshwater&species=1');
  expect(screen.getByRole('link', { name: 'guides.categories.marine.title' })).toHaveAttribute('href', '/guides?category=marine&species=1');
});

it('une erreur d’équipement conserve l’accès aux informations de l’espèce', async () => {
  mocked.getRecommendedEquipment.mockRejectedValue(new Error('Unavailable'));
  render(<GuidesPage />);
  expect(await screen.findByRole('heading', { name: 'Boa constricteur' })).toBeInTheDocument();
  expect(screen.getByText('guides.noEquipment')).toBeInTheDocument();
});
