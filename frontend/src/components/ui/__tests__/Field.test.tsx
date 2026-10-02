import { render, screen } from '@testing-library/react';
import Field from '../Field';

describe('ui/Field', () => {
  it('relie le libellé au contrôle (élément enfant)', () => {
    render(
      <Field label="Nom de l'animal">
        <input type="text" />
      </Field>,
    );
    const input = screen.getByLabelText("Nom de l'animal");
    expect(input.tagName).toBe('INPUT');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('annonce l’aide et l’erreur via aria-describedby et passe en aria-invalid', () => {
    render(
      <Field label="Poids" hint="En grammes" error="Valeur attendue entre 1 et 50 000" id="poids">
        <input type="number" />
      </Field>,
    );
    const input = screen.getByLabelText('Poids');
    expect(input).toHaveAttribute('id', 'poids');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'poids-hint poids-error');
    expect(input).toHaveAccessibleDescription('En grammes Valeur attendue entre 1 et 50 000');
  });

  it('champ obligatoire : `required` sur le contrôle, astérisque décorative', () => {
    render(
      <Field label="Espèce" required>
        <select>
          <option>Boa</option>
        </select>
      </Field>,
    );
    const select = screen.getByRole('combobox', { name: 'Espèce' });
    expect(select).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('accepte une fonction enfant qui reçoit les attributs du contrôle', () => {
    render(
      <Field label="Notes" hint="500 caractères au plus">
        {(control) => <textarea {...control} data-testid="notes" />}
      </Field>,
    );
    const textarea = screen.getByTestId('notes');
    expect(screen.getByLabelText('Notes')).toBe(textarea);
    expect(textarea).toHaveAccessibleDescription('500 caractères au plus');
  });

  it('conserve un aria-describedby déjà posé sur le contrôle', () => {
    render(
      <>
        <p id="consigne">Format JJ/MM/AAAA</p>
        <Field label="Date" hint="Date de la pesée" id="date">
          <input aria-describedby="consigne" />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('Date')).toHaveAttribute('aria-describedby', 'consigne date-hint');
  });
});
