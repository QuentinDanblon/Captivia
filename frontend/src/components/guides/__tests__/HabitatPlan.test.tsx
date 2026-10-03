import { fireEvent, render, screen } from '@testing-library/react';
import { HabitatPlan, habitatVolume } from '../HabitatPlan';

describe('HabitatPlan', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 50_001])('refuse une mesure invalide : %s', (value) => {
    expect(habitatVolume(value, 40, 50)).toBeNull();
    expect(habitatVolume(100, value, 50)).toBeNull();
    expect(habitatVolume(100, 40, value)).toBeNull();
  });

  it('calcule le volume géométrique en litres, y compris des mesures décimales', () => {
    expect(habitatVolume(100, 40, 50)).toBe(200);
    expect(habitatVolume(10.5, 20, 30)).toBe(6.3);
  });

  it('aucun chiffre de dimension ou volume ne remplace les mesures absentes', () => {
    render(<HabitatPlan />);
    screen.getAllByRole('spinbutton').forEach((input) => expect(input).toHaveValue(null));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('planHint')).toBeInTheDocument();
  });

  it('montre les deux vues après trois mesures puis retire le plan si une mesure est effacée', () => {
    render(<HabitatPlan />);
    fireEvent.change(screen.getByLabelText('length'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('width'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('height'), { target: { value: '50' } });
    expect(screen.getByRole('img', { name: 'planTop' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'planFront' })).toBeInTheDocument();
    expect(screen.getByText('planVolumeHint')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('height'), { target: { value: '' } });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('place uniquement les équipements choisis sur la vue du dessus et permet de retirer un repère', () => {
    render(<HabitatPlan equipment={['filter', 'heater']} />);
    fireEvent.click(screen.getByText('planEquipment'));
    const filter = screen.getByLabelText('filter');
    expect(filter).toHaveValue('none');
    expect(screen.getByLabelText('heater')).toHaveValue('none');

    fireEvent.change(screen.getByLabelText('length'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('width'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('height'), { target: { value: '50' } });
    const top = screen.getByRole('img', { name: 'planTop' });
    const front = screen.getByRole('img', { name: 'planFront' });
    expect(top.querySelectorAll('circle')).toHaveLength(0);
    expect(front.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: 'left' } });
    const marker = top.querySelector('circle')!;
    expect(top.querySelectorAll('circle')).toHaveLength(1);
    expect(marker).toHaveAttribute('cx', '116');
    expect(marker).toHaveAttribute('cy', '65.8');
    expect(marker).toHaveAttribute('r', '12');
    expect(marker.nextElementSibling).toHaveAttribute('font-size', '18');
    expect(front.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.getByRole('listitem')).toHaveTextContent('1. filter — planPositions.left');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    fireEvent.change(filter, { target: { value: 'none' } });
    expect(top.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
