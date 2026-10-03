import { render, screen, waitFor } from '@testing-library/react';
import { SpeciesCard } from '../SpeciesCard';

jest.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, value), key),
}));

jest.mock('@/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
jest.mock('@/lib/api', () => ({ api: { getMedia: jest.fn() } }));

import { api } from '@/lib/api';
const mockGetMedia = api.getMedia as jest.Mock;

describe('carte d’espèce avec correspondance de photo éditoriale', () => {
  beforeEach(() => mockGetMedia.mockReset());

  it.each([
    { id: 2000000003, commonNameFr: 'Golden Retriever', latin: 'Canis lupus familiaris', path: '/images/animals/dog-golden-retriever', author: 'Dietmar Rabich' },
    { id: 5281802, commonNameFr: 'Chat domestique', latin: 'Felis catus', path: '/images/animals/cat-straw', author: 'Basile Morin' },
    { id: 5221172, commonNameFr: 'Gecko Léopard', latin: 'Eublepharis macularius', path: '/images/animals/leopard-gecko', author: 'George Chernilevsky' },
  ])('%s affiche sa photo réelle, son crédit et sa licence', async (species) => {
    render(
      <ul>
        <SpeciesCard species={{ id: species.id, commonNameFr: species.commonNameFr, latin: species.latin, group: null, iucn: null }} />
      </ul>,
    );

    const photo = await screen.findByRole('img');
    expect(photo.getAttribute('src')).toContain(species.path);
    expect(screen.getByRole('link', { name: species.author })).toHaveAttribute('href', expect.stringContaining('commons.wikimedia.org/wiki/File:'));
    expect(screen.getByRole('link', { name: /CC BY|Domaine public/ }).getAttribute('rel')).toContain('license');
    expect(mockGetMedia).not.toHaveBeenCalled();
  });

  it('ne remplace pas une photo précise de race par celle d’une autre race', async () => {
    mockGetMedia.mockResolvedValue([]);
    render(
      <ul>
        <SpeciesCard species={{ id: 2000000001, commonNameFr: 'Berger allemand', latin: 'Canis lupus familiaris', group: null, iucn: null }} />
      </ul>,
    );

    await waitFor(() => expect(screen.getByTestId('species-card').querySelector('.cv-photo__fallback')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Dietmar Rabich' })).not.toBeInTheDocument();
    expect(mockGetMedia).not.toHaveBeenCalled();
  });
});
