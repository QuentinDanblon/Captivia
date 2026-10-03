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

  it('variantes responsives : <picture> AVIF + WebP, chargement prioritaire, crédit en cartouche', () => {
    const { container } = render(
      <Figure
        src="/images/boa-800.webp"
        srcSet="/images/boa-480.webp 480w, /images/boa-800.webp 800w"
        sources={[{ type: 'image/avif', srcSet: '/images/boa-480.avif 480w, /images/boa-800.avif 800w' }]}
        sizes="50vw"
        alt="Boa"
        priority
        objectPosition="70% 40%"
        creditPlacement="overlay"
        credit={credit}
      />,
    );
    const source = container.querySelector('picture > source')!;
    expect(source).toHaveAttribute('type', 'image/avif');
    expect(source).toHaveAttribute('sizes', '50vw');
    const img = screen.getByRole('img', { name: 'Boa' });
    expect(img).toHaveAttribute('srcset', expect.stringContaining('boa-800.webp 800w'));
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveStyle({ objectPosition: '70% 40%' });
    // Crédit posé sur la photo, pas en légende, toujours lié à la source et à la licence.
    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('.cv-photo .cv-photo__credit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute('href', credit.sourceUrl);
  });
});
