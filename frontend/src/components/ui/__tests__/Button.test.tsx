import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Button, { buttonClasses } from '../Button';

describe('ui/Button', () => {
  it('rend un bouton type="button" (pas de soumission involontaire) en variante primaire', () => {
    render(<Button>Enregistrer</Button>);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('bg-accent');
    expect(button.className).toContain('text-on-accent');
    expect(button.className).toContain('min-h-11');
  });

  it('applique variantes et tailles', () => {
    const { rerender } = render(
      <Button variant="secondary" size="sm">
        Annuler
      </Button>,
    );
    let button = screen.getByRole('button', { name: 'Annuler' });
    expect(button.className).toContain('border-line-field');
    expect(button.className).toContain('pointer-coarse:min-h-11');

    rerender(<Button variant="danger">Supprimer</Button>);
    button = screen.getByRole('button', { name: 'Supprimer' });
    expect(button.className).toContain('bg-danger');

    rerender(<Button variant="quiet">Modifier</Button>);
    expect(screen.getByRole('button', { name: 'Modifier' }).className).toContain('text-accent-text');
  });

  it('accepte encore `ghost` (ancien nom de `quiet`)', () => {
    expect(buttonClasses({ variant: 'ghost' })).toBe(buttonClasses({ variant: 'quiet' }));
  });

  it('état chargement : aria-busy, désactivé, indicateur décoratif, libellé conservé', () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Envoi
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Envoi' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('transmet les attributs natifs, la ref et les icônes décoratives', () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = jest.fn();
    render(
      <Button ref={ref} type="submit" fullWidth iconStart={<svg data-testid="icon" />} onClick={onClick}>
        Valider
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Valider' });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('type', 'submit');
    expect(button.className).toContain('w-full');
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('buttonClasses() stylise un lien comme un bouton', () => {
    render(
      <a href="https://example.org/inscription" className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'mt-4' })}>
        Créer un compte
      </a>,
    );
    const link = screen.getByRole('link', { name: 'Créer un compte' });
    expect(link.className).toContain('min-h-12');
    expect(link.className).toContain('mt-4');
  });
});
