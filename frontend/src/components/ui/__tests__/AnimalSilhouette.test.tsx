import { render, screen } from '@testing-library/react';
import AnimalSilhouette, { silhouetteKindOf, type SilhouetteKind } from '../AnimalSilhouette';

describe('ui/AnimalSilhouette', () => {
  it('décorative par défaut (aria-hidden), au trait (currentColor, sans remplissage)', () => {
    const { container } = render(<AnimalSilhouette kind="fish" size={64} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(2);
  });

  it('avec un titre : image nommée', () => {
    render(<AnimalSilhouette kind="bird" title="Oiseau" />);
    expect(screen.getByRole('img', { name: 'Oiseau' })).toBeInTheDocument();
  });

  it.each<[string | null, SilhouetteKind]>([
    ['Reptilia', 'reptile'],
    ['Squamata', 'reptile'],
    ['Aves', 'bird'],
    ['oiseau', 'bird'],
    ['Mammalia', 'mammal'],
    ['Amphibia', 'amphibian'],
    ['Actinopterygii', 'fish'],
    ['Insecta', 'invertebrate'],
    ['Arachnida', 'invertebrate'],
    ['Plantae', 'other'],
    [null, 'other'],
  ])('silhouetteKindOf(%p) → %p', (input, expected) => {
    expect(silhouetteKindOf(input)).toBe(expected);
  });
});
