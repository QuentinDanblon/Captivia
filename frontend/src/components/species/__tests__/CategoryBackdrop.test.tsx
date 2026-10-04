import { render } from '@testing-library/react';
import { CategoryBackdrop } from '../CategoryBackdrop';
import { CATEGORY_TEXTURES } from '@/content/category-textures';
import { PHOTOS } from '@/content/photos';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('fond photographique des catégories', () => {
  it('décrit six matières réelles, chacune avec une source et une licence', () => {
    expect(Object.keys(CATEGORY_TEXTURES).sort()).toEqual(['amphibians', 'birds', 'fish', 'insects', 'mammals', 'reptiles']);
    for (const key of Object.values(CATEGORY_TEXTURES)) {
      expect(PHOTOS[key].credit.sourceUrl).toMatch(/^https:\/\/commons.wikimedia.org\/wiki\/File:/);
      expect(PHOTOS[key].credit.license).toMatch(/^CC BY|Domaine public/);
    }
  });
  it('répète les photographies sur quatre images réfléchies et active uniquement la catégorie choisie', () => {
    const { container } = render(<CategoryBackdrop selectedId="fish" />);
    expect(container.querySelectorAll('svg')).toHaveLength(6);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-active="true"]')).toHaveAttribute('data-texture-layer', 'fish');
    for (const pattern of container.querySelectorAll('pattern')) {
      expect(pattern.querySelectorAll('image')).toHaveLength(4);
      expect(pattern.querySelector('image[transform="translate(384 384) scale(-1 -1)"]')).not.toBeNull();
    }
  });
  it('désactive les matières quand le filtre revient à toutes les espèces', () => {
    const { container, rerender } = render(<CategoryBackdrop selectedId="birds" />);
    rerender(<CategoryBackdrop selectedId={null} />);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(0);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
