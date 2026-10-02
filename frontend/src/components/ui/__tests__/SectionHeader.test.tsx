import { render, screen } from '@testing-library/react';
import SectionHeader from '../SectionHeader';

describe('ui/SectionHeader', () => {
  it('planche naturaliste : titre, binôme latin en italique, autorité, identifiant en marge', () => {
    const { container } = render(
      <SectionHeader
        title="Boa constricteur"
        latin="Boa constrictor"
        authority="Linnaeus, 1758"
        marginNote="GBIF 2435099"
        marginLabel="Identifiant GBIF"
        id="espece-titre"
      />,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Boa constricteur' });
    expect(heading).toHaveAttribute('id', 'espece-titre');

    const latin = screen.getByText('Boa constrictor');
    expect(latin.tagName).toBe('I');
    expect(latin).toHaveAttribute('lang', 'la');
    expect(screen.getByText(/Linnaeus, 1758/)).toBeInTheDocument();

    expect(screen.getByText('Identifiant GBIF :', { exact: false })).toHaveClass('sr-only');
    expect(screen.getByText('GBIF 2435099', { exact: false })).toBeInTheDocument();

    const rule = container.querySelector('[data-rule]');
    expect(rule).toHaveAttribute('aria-hidden', 'true');
    expect(rule).toHaveAttribute('data-rule', 'double');
  });

  it('niveau 3 : filet simple ; actions et description', () => {
    const { container } = render(
      <SectionHeader
        level={3}
        title="Traitements en cours"
        description="Doses et horaires prescrits par le vétérinaire."
        actions={<button type="button">Ajouter</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Traitements en cours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
    expect(screen.getByText('Doses et horaires prescrits par le vétérinaire.')).toBeInTheDocument();
    expect(container.querySelector('[data-rule]')).toHaveAttribute('data-rule', 'single');
  });

  it('sans identifiant : pas de colonne de marge', () => {
    const { container } = render(<SectionHeader level={2} title="Mes animaux" />);
    expect(container.querySelector('header')!.className).toContain('grid-cols-1');
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});
