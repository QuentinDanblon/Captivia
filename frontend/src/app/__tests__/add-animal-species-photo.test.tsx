import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, searchSpecies: jest.fn(), getMedia: jest.fn() } };
});
jest.mock('@/components/usePhotoPicker', () => ({ usePhotoPicker: () => ({ inputRef: { current: null }, open: jest.fn(), onChange: jest.fn() }) }));

import { api } from '@/lib/api';
import AddAnimalFlow from '../[locale]/(app)/mes-animaux/_components/AddAnimalFlow';
const mockApi = api as typeof api & { searchSpecies: jest.Mock; getMedia: jest.Mock };

describe('choix d’espèce dans l’ajout d’un animal', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockApi.searchSpecies.mockReset();
    mockApi.getMedia.mockReset();
  });

  it('montre la photo exacte et son crédit, puis permet de sélectionner l’espèce', async () => {
    mockApi.searchSpecies.mockResolvedValue({ results: [{
      key: 5221172,
      scientificName: 'Eublepharis macularius',
      canonicalName: 'Gecko Léopard',
      vernacularName: 'Gecko Léopard',
    }] });
    const onCreated = jest.fn();
    const onClose = jest.fn();
    render(<AddAnimalFlow token="token" isGuest={false} onCreated={onCreated} onClose={onClose} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gecko' } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    const photo = await screen.findByRole('img');
    expect(photo.getAttribute('src')).toContain('/images/animals/leopard-gecko');
    expect(screen.getByRole('link', { name: 'George Chernilevsky' })).toHaveAttribute('href', expect.stringContaining('commons.wikimedia.org/wiki/File:'));
    expect(screen.getByRole('link', { name: 'Domaine public' }).getAttribute('rel')).toContain('license');
    fireEvent.click(screen.getByRole('button', { name: /Gecko Léopard/ }));
    expect(await screen.findByText('onboarding.speciesChosen')).toBeInTheDocument();
    expect(mockApi.getMedia).not.toHaveBeenCalled();
  });
});
