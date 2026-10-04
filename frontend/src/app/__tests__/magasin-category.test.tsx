import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { api } from '@/lib/api';
import MagasinPage from '../[locale]/(app)/magasin/page';

jest.mock('@/lib/api', () => ({ api: { getAffiliateStores: jest.fn() } }));
jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

const mocked = api as jest.Mocked<typeof api>;

beforeEach(() => {
  window.history.replaceState({}, '', '/fr/magasin?category=reptile');
  mocked.getAffiliateStores.mockResolvedValue([
    { id: 'reptile-shop', name: 'Terrarium', url: 'https://example.com/reptiles', categories: ['reptile'], types: ['Matériel'] },
    { id: 'mammal-shop', name: 'Mammifères', url: 'https://example.com/mammals', categories: ['mammifère'], types: ['Matériel'] },
  ]);
});

afterEach(() => {
  window.history.replaceState({}, '', '/fr/magasin');
  jest.clearAllMocks();
});

it('préselectionne le filtre du guide sans charger les catégories étrangères', async () => {
  render(<MagasinPage />);

  expect(await screen.findByRole('heading', { name: 'Terrarium' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Mammifères' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('store.filterByCategory')).toHaveValue('reptile');
  expect(mocked.getAffiliateStores).toHaveBeenCalledWith(undefined, undefined);
});
