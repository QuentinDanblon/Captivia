import { render } from '@testing-library/react';
import { useEffect } from 'react';

/**
 * Revue frontend, constat 5 : sur mobile, les fiches sont des routes à query (`detail?id=`).
 * Changer d'id doit REMONTER la page (key), sinon elle garde l'état de la fiche précédente.
 */
let mockQuery = 'id=a1';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock('@/lib/platform', () => ({
  useQueryRouteParams: (name: string) =>
    Promise.resolve({ locale: 'fr', [name]: new URLSearchParams(mockQuery).get(name) ?? '' }),
}));

const mounts: string[] = [];
function makePage(label: string) {
  return function FakePage() {
    useEffect(() => {
      mounts.push(`${label}:${mockQuery}`);
    }, []);
    return null;
  };
}
jest.mock('@/app/[locale]/(app)/mes-animaux/[id]/page', () => ({ __esModule: true, default: makePage('animal') }));
jest.mock('@/app/[locale]/(app)/species/[id]/page', () => ({ __esModule: true, default: makePage('species') }));
jest.mock('@/app/[locale]/(marketing)/animal-public/[slug]/page', () => ({ __esModule: true, default: makePage('public') }));
jest.mock('@/app/[locale]/(app)/communaute/publication/[id]/page', () => ({ __esModule: true, default: makePage('post') }));
jest.mock('@/app/[locale]/(app)/communaute/u/[handle]/page', () => ({ __esModule: true, default: makePage('member') }));
jest.mock('@/app/[locale]/(app)/mes-animaux/[id]/carnet/CarnetPrintView', () => ({
  __esModule: true,
  default: makePage('carnet'),
}));

import MobileAnimalDetailPage from '../../../mobile/app/[locale]/(app)/mes-animaux/detail/page';
import MobileSpeciesPage from '../../../mobile/app/[locale]/(app)/species/page';
import MobilePublicAnimalPage from '../../../mobile/app/[locale]/(marketing)/animal-public/page';
import MobileCarnetPage from '../../../mobile/app/[locale]/(app)/mes-animaux/carnet/page';
import MobileCommunityPostPage from '../../../mobile/app/[locale]/(app)/communaute/publication/page';
import MobileCommunityMemberPage from '../../../mobile/app/[locale]/(app)/communaute/u/page';

describe('overlays mobile : une fiche par id', () => {
  beforeEach(() => {
    mounts.length = 0;
  });

  it.each([
    ['animal', MobileAnimalDetailPage, 'id'],
    ['species', MobileSpeciesPage, 'id'],
    ['public', MobilePublicAnimalPage, 'slug'],
    ['carnet', MobileCarnetPage, 'id'],
    ['post', MobileCommunityPostPage, 'id'],
    ['member', MobileCommunityMemberPage, 'handle'],
  ] as const)('%s : changer de %s remonte la page', (label, Page, param) => {
    mockQuery = `${param}=a1`;
    const { rerender } = render(<Page />);
    rerender(<Page />);
    expect(mounts).toEqual([`${label}:${param}=a1`]);

    mockQuery = `${param}=b2`;
    rerender(<Page />);
    expect(mounts).toEqual([`${label}:${param}=a1`, `${label}:${param}=b2`]);
  });
});
