import { render, screen, within } from '@testing-library/react';
import Card from '../Card';

describe('ui/Card', () => {
  it('rend une surface à filet, sans ombre, et son contenu', () => {
    render(<Card data-testid="card">Contenu</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveTextContent('Contenu');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('rounded-card');
    expect(card.className).not.toMatch(/shadow/);
  });

  it('section titrée : région nommée par son titre (aria-labelledby)', () => {
    render(
      <Card as="section" title="Traitements" titleId="traitements" actions={<button type="button">Ajouter</button>}>
        <p>Aucun traitement.</p>
      </Card>,
    );
    const region = screen.getByRole('region', { name: 'Traitements' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Traitements' })).toHaveAttribute('id', 'traitements');
    expect(within(region).getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('niveau de titre, ton et marge configurables', () => {
    render(
      <Card title="Notes" headingLevel={3} tone="sunken" padding="none" data-testid="card">
        …
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Notes' })).toBeInTheDocument();
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-sunken');
    expect(card.className).not.toContain('p-4');
  });

  it('sans titre ni actions : pas d’en-tête', () => {
    render(<Card as="article">Texte</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveTextContent('Texte');
  });
});
