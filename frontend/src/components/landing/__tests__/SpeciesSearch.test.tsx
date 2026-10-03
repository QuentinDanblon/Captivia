import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const searchSpecies = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { searchSpecies: (...args: unknown[]) => searchSpecies(...args) },
}));

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { SpeciesSearch } from '../SpeciesSearch';

/** Audit : « chien », Rechercher, puis le raccourci « Mammifères » relançait « chien ». */
describe('SpeciesSearch', () => {
  beforeEach(() => {
    searchSpecies.mockReset().mockResolvedValue({ results: [], total: 0 });
  });

  it('un raccourci de groupe cherche sans l’ancienne requête', async () => {
    render(<SpeciesSearch />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'chien' } });
    fireEvent.click(screen.getByRole('button', { name: 'landing.search.submit' }));
    await waitFor(() => expect(searchSpecies).toHaveBeenCalledWith('chien', 24, 0, {}));

    fireEvent.click(screen.getByRole('button', { name: 'Mammalia' }));
    await waitFor(() => expect(searchSpecies).toHaveBeenLastCalledWith('', 24, 0, { class: 'Mammalia' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
