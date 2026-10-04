import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HabitatPlan, habitatVolume, parseHabitatDimensions } from '../HabitatPlan';

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

  it('ne préremplit que trois mesures explicites avec une unité reconnue', () => {
    expect(parseHabitatDimensions('45 × 45 × 60 cm')).toEqual(['45', '45', '60']);
    expect(parseHabitatDimensions('1,2 x 0.8 x 1.5 m')).toEqual(['120', '80', '150']);
    expect(parseHabitatDimensions('Base minimale : 18 × 18 × 36 pouces (L × l × H)')).toEqual(['45.7', '45.7', '91.4']);
    expect(parseHabitatDimensions('Enclos spacieux')).toBeNull();
    expect(parseHabitatDimensions('45 x 45 cm')).toBeNull();
  });

  it('aucun chiffre de dimension ou volume ne remplace les mesures absentes', () => {
    render(<HabitatPlan />);
    screen.getAllByRole('spinbutton').forEach((input) => expect(input).toHaveValue(null));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('planHint')).toBeInTheDocument();
  });

  it('utilise les dimensions documentées en valeur initiale du plan', () => {
    render(<HabitatPlan suggestedDimensions={['45', '45', '60']} />);
    expect(screen.getByLabelText('length')).toHaveValue(45);
    expect(screen.getByLabelText('width')).toHaveValue(45);
    expect(screen.getByLabelText('height')).toHaveValue(60);
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

  it('enregistre le plan localement et le restaure pour la même espèce', async () => {
    const first = render(<HabitatPlan storageKey="species-42" equipment={['vivarium']} />);
    fireEvent.change(screen.getByLabelText('length'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('width'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('height'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('vivarium'), { target: { value: 'left' } });
    fireEvent.click(screen.getByRole('button', { name: 'planSave' }));
    expect(screen.getByText('planSaved')).toBeInTheDocument();
    expect(localStorage.getItem('captivia.habitat-plan.species-42')).toContain('"length":"90"');
    first.unmount();

    render(<HabitatPlan storageKey="species-42" equipment={['vivarium']} />);
    await waitFor(() => expect(screen.getByLabelText('length')).toHaveValue(90));
    expect(screen.getByLabelText('width')).toHaveValue(45);
    expect(screen.getByLabelText('height')).toHaveValue(60);
    expect(screen.getByLabelText('vivarium')).toHaveValue('left');
  });
});
