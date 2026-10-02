import { render, screen } from '@testing-library/react';
import EmptyState from '../EmptyState';
import AnimalSilhouette from '../AnimalSilhouette';

describe('ui/EmptyState', () => {
  it('un constat, un bénéfice, une action', () => {
    render(
      <EmptyState
        title="Aucune pesée enregistrée"
        benefit="Une pesée par mois suffit à repérer une perte de poids avant les premiers symptômes."
        action={<button type="button">Ajouter une pesée</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Aucune pesée enregistrée' })).toBeInTheDocument();
    expect(screen.getByText(/Une pesée par mois/)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('illustration décorative, niveau de titre et format page', () => {
    const { container } = render(
      <EmptyState
        title="Aucun animal"
        benefit="Ajoutez votre premier animal pour ouvrir son carnet de santé."
        illustration={<AnimalSilhouette kind="reptile" />}
        headingLevel={2}
        size="page"
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Aucun animal' }).className).toContain('text-h3');
    const illustration = container.querySelector('svg')!.parentElement!;
    expect(illustration).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
