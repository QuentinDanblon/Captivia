import { fireEvent, render, screen } from '@testing-library/react';
import { CategoryCards } from '../CategoryCards';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

function pointer(target: Element, type: string, x = 0, y = 0) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  fireEvent(target, event);
}

describe('cartes photographiques des catégories', () => {
  it('affiche six cartes dans l’ordre demandé, chacune avec une photo et un crédit extérieur', () => {
    render(<CategoryCards selectedId={null} onSelect={jest.fn()} />);
    const cards = screen.getAllByRole('button');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'groups.mammals', 'groups.birds', 'groups.fish', 'groups.reptiles', 'groups.amphibians', 'groups.insects',
    ]);
    for (const card of cards) {
      expect(card.querySelector('img')?.getAttribute('src')).toMatch(/^\/images\/categories\//);
      expect(card.querySelector('a')).toBeNull();
      expect(card.parentElement?.querySelector('a[rel~="license"]')).toBeTruthy();
    }
  });
  it('sélectionne la bonne catégorie par un appui', () => {
    const select = jest.fn();
    render(<CategoryCards selectedId="birds" onSelect={select} />);
    expect(screen.getByRole('button', { name: 'groups.birds' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'groups.fish' }));
    expect(select).toHaveBeenCalledWith('fish');
  });
  it('ignore le clic généré après un glissement, puis accepte l’appui suivant', () => {
    const select = jest.fn();
    render(<CategoryCards selectedId={null} onSelect={select} />);
    const card = screen.getByRole('button', { name: 'groups.mammals' });
    pointer(card, 'pointerdown', 40, 200);
    pointer(card, 'pointermove', 40, 100);
    pointer(card, 'pointerup', 40, 100);
    fireEvent.click(card, { detail: 1 });
    expect(select).not.toHaveBeenCalled();
    pointer(card, 'pointerdown', 40, 100);
    pointer(card, 'pointerup', 40, 100);
    fireEvent.click(card, { detail: 1 });
    expect(select).toHaveBeenCalledWith('mammals');
  });
  it('ignore un geste annulé par le navigateur et conserve l’activation au clavier', () => {
    const select = jest.fn();
    render(<CategoryCards selectedId={null} onSelect={select} />);
    const card = screen.getByRole('button', { name: 'groups.reptiles' });
    pointer(card, 'pointerdown');
    pointer(card, 'pointercancel');
    fireEvent.click(card, { detail: 1 });
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(card, { detail: 0 });
    expect(select).toHaveBeenCalledWith('reptiles');
  });
});
