import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import NumberWheel from '../NumberWheel';

function Harness({ max = 30 }: { max?: number }) {
  const [value, setValue] = useState(3);
  return <NumberWheel id="duration" label="Durée" hint="Faites défiler" max={max} value={value}
    valueText={(n) => `${n} jours`} onChange={setValue} />;
}

describe('ui/NumberWheel', () => {
  const original = HTMLElement.prototype.scrollTo;
  beforeEach(() => {
    jest.useFakeTimers();
    HTMLElement.prototype.scrollTo = function (options) {
      if (typeof options === 'object') this.scrollTop = options.top ?? 0;
    };
  });
  afterEach(() => {
    jest.useRealTimers();
    HTMLElement.prototype.scrollTo = original;
  });
  it('annonce la valeur, l’unité, les bornes et l’aide', () => {
    render(<Harness />);
    const wheel = screen.getByRole('spinbutton', { name: 'Durée' });
    expect(wheel).toHaveAttribute('aria-valuenow', '3');
    expect(wheel).toHaveAttribute('aria-valuemin', '1');
    expect(wheel).toHaveAttribute('aria-valuemax', '30');
    expect(wheel).toHaveAttribute('aria-valuetext', '3 jours');
    expect(wheel).toHaveAccessibleDescription('Faites défiler');
    expect(wheel.scrollTop).toBe(88);
  });
  it('clavier : flèches, pages et bornes sans dépassement', () => {
    render(<Harness max={12} />);
    const wheel = screen.getByRole('spinbutton');
    for (const [key, value] of [['ArrowUp', 4], ['PageUp', 9], ['End', 12], ['ArrowUp', 12], ['Home', 1], ['ArrowDown', 1], ['PageUp', 6], ['PageDown', 1]] as const) {
      fireEvent.keyDown(wheel, { key });
      expect(wheel).toHaveAttribute('aria-valuenow', String(value));
      expect(wheel.scrollTop).toBe((value - 1) * 44);
    }
  });
  it('le défilement choisit le cran central une fois stabilisé', () => {
    render(<Harness />);
    const wheel = screen.getByRole('spinbutton');
    wheel.scrollTop = 44 * 7;
    fireEvent.scroll(wheel);
    act(() => { jest.advanceTimersByTime(150); });
    expect(wheel).toHaveAttribute('aria-valuenow', '8');
  });
  it('un clic choisit une valeur et conserve le focus sur la roulette', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('4 jours'));
    const wheel = screen.getByRole('spinbutton');
    expect(wheel).toHaveAttribute('aria-valuenow', '4');
    expect(wheel).toHaveFocus();
  });
  it('annule un défilement en attente lors du démontage', () => {
    const view = render(<Harness />);
    fireEvent.scroll(screen.getByRole('spinbutton'));
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
