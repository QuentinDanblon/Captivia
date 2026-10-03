import { fireEvent, render, screen } from '@testing-library/react';
import Figure from '../Figure';

const credit = {
  author: 'Jane Doe',
  license: 'CC BY-SA 4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Boa.jpg',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

describe('ui/Figure', () => {
  it('photo : texte alternatif, chargement différé, ratio réservé, crédit et licence liés', () => {
    const { container } = render(
      <Figure src="/images/boa.jpg" alt="Boa enroulé sur une branche" ratio="3/2" treatment="grain" credit={credit} caption="Individu adulte" />,
    );
    const img = screen.getByRole('img', { name: 'Boa enroulé sur une branche' });
    expect(img).toHaveAttribute('loading', 'lazy');
    const frame = container.querySelector('.cv-photo')!;
    expect(frame.className).toContain('aspect-[3/2]');
    expect(frame).toHaveAttribute('data-treatment', 'grain');
    expect(screen.getByText('Individu adulte')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute('href', credit.sourceUrl);
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('rel', expect.stringContaining('license'));
  });

  it('sans photo : silhouette au trait dans le même cadre, sans crédit', () => {
    const { container } = render(<Figure fallbackKind="bird" alt="Perruche" />);
    expect(screen.getByRole('img', { name: 'Perruche' }).tagName.toLowerCase()).toBe('svg');
    expect(container.querySelector('svg[data-kind="bird"]')).toBeInTheDocument();
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('erreur de chargement : repli en silhouette', () => {
    const { container } = render(<Figure src="/images/absente.jpg" alt="Gecko" fallbackKind="reptile" credit={credit} />);
    fireEvent.error(screen.getByRole('img', { name: 'Gecko' }));
    expect(container.querySelector('svg[data-kind="reptile"]')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Jane Doe' })).not.toBeInTheDocument();
  });
});
