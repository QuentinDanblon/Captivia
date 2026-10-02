import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const getCarnetExport = jest.fn();
const getSpecies = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    getCarnetExport: (...args: unknown[]) => getCarnetExport(...args),
    getSpecies: (...args: unknown[]) => getSpecies(...args),
  },
}));

const push = jest.fn();
jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ push, replace: jest.fn() }),
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

let mockAuth: { user: { id: string } | null; token: string | null; isLoading: boolean } = {
  user: { id: 'u1' },
  token: 'tok',
  isLoading: false,
};
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'animal-1' }) }));

import CarnetPrintPage from '../[locale]/mes-animaux/[id]/carnet/page';

const FUTURE = '2099-01-01T00:00:00.000Z';

const carnet = {
  exportedAt: '2026-10-02T09:30:00.000Z',
  animal: {
    id: 'animal-1',
    name: 'Rango',
    speciesId: 4242,
    sex: 'male',
    birthDate: '2021-03-14T00:00:00.000Z',
    groupName: 'Terrarium nord',
    microchip: '250268500123456',
  },
  sections: {
    healthRecords: [
      { id: 'h1', type: 'surgery', title: 'Ablation de kyste', date: '2025-05-02T00:00:00.000Z', notes: 'RAS' },
      { id: 'h2', type: 'medical_history', title: 'Parasites internes', date: '2026-01-10T00:00:00.000Z', notes: null },
    ],
    measurements: [
      { id: 'm1', weightKg: 1.2, heightCm: null, measuredAt: '2026-02-01T00:00:00.000Z', notes: null },
      { id: 'm2', weightKg: 1.45, heightCm: 30, measuredAt: '2026-06-01T00:00:00.000Z', notes: 'Après repas' },
    ],
    vaccinations: [
      {
        id: 'v1',
        name: 'Rage',
        date: '2025-04-01T00:00:00.000Z',
        nextDueDate: '2026-04-01T00:00:00.000Z',
        batchNumber: 'LOT-889',
        vetName: 'Dr Martin',
        notes: null,
      },
    ],
    medications: [
      { id: 'd1', name: 'Metacam', dose: '0.2', unit: 'ml', frequency: 'daily', startDate: '2026-09-20T00:00:00.000Z', endDate: FUTURE, active: true },
      { id: 'd2', name: 'Antibiotique ancien', dose: '5', unit: 'mg', frequency: 'weekly', startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-01-15T00:00:00.000Z', active: true },
      { id: 'd3', name: 'Traitement arrêté', dose: '1', unit: 'ml', frequency: 'daily', startDate: '2026-01-01T00:00:00.000Z', endDate: null, active: false },
      { id: 'd4', name: 'Vitamines', dose: '2', unit: 'gouttes', frequency: 'every_x_hours', intervalHours: 8, startDate: '2026-09-01T00:00:00.000Z', endDate: null, active: true },
    ],
    vetAppointments: [
      { id: 'a1', vetName: 'Dr Martin', reason: 'Contrôle annuel', date: '2026-11-05T10:00:00.000Z', location: 'Clinique des Lilas', status: 'scheduled', reminderDays: [7, 1] },
      { id: 'a2', vetName: 'dr martin', reason: null, date: '2025-04-01T10:00:00.000Z', location: null, status: 'done', reminderDays: [] },
      { id: 'a3', vetName: 'Dr Dupont', reason: null, date: '2025-08-01T10:00:00.000Z', location: null, status: 'cancelled', reminderDays: [] },
    ],
  },
};

describe('carnet imprimable', () => {
  beforeEach(() => {
    getCarnetExport.mockReset();
    getSpecies.mockReset();
    push.mockReset();
    getCarnetExport.mockResolvedValue(carnet);
    getSpecies.mockResolvedValue({ scientificName: 'Pogona vitticeps', vernacularName: 'Agame barbu' });
    mockAuth = { user: { id: 'u1' }, token: 'tok', isLoading: false };
  });

  it('charge le carnet puis affiche identité, vaccins, traitements, santé, poids, RDV et contacts', async () => {
    render(<CarnetPrintPage />);

    expect(screen.getByRole('status')).toHaveTextContent('carnetPrint.loading');
    await screen.findByRole('heading', { level: 1, name: 'carnetPrint.title' });
    expect(getCarnetExport).toHaveBeenCalledWith('animal-1', 'tok');

    // Identité
    expect(screen.getByText('Rango')).toBeInTheDocument();
    expect(screen.getByText('animals.male')).toBeInTheDocument();
    expect(screen.getByText('250268500123456')).toBeInTheDocument();
    expect(screen.getByText('Terrarium nord')).toBeInTheDocument();
    await screen.findByText(/Agame barbu/);
    expect(screen.getByText('(Pogona vitticeps)')).toBeInTheDocument();

    // En-tête Captivia + mention légale
    expect(screen.getByText('Captivia')).toBeInTheDocument();
    expect(screen.getByText('carnetPrint.disclaimer')).toBeInTheDocument();
    expect(screen.getByText('carnetPrint.editedOn')).toBeInTheDocument();

    // Vaccins
    const vaccines = screen.getByRole('heading', { name: 'animals.vaccinations.title' }).closest('section')!;
    expect(within(vaccines).getByText('Rage')).toBeInTheDocument();
    expect(within(vaccines).getByText('LOT-889')).toBeInTheDocument();

    // Traitements : seulement ceux en cours (actifs, non terminés)
    const treatments = screen.getByRole('heading', { name: 'carnetPrint.currentTreatments' }).closest('section')!;
    expect(within(treatments).getByText('Metacam')).toBeInTheDocument();
    expect(within(treatments).getByText('Vitamines')).toBeInTheDocument();
    expect(within(treatments).getByText('0.2 ml')).toBeInTheDocument();
    expect(within(treatments).queryByText('Antibiotique ancien')).not.toBeInTheDocument();
    expect(within(treatments).queryByText('Traitement arrêté')).not.toBeInTheDocument();

    // Historique de santé
    const health = screen.getByRole('heading', { name: 'carnetPrint.healthHistory' }).closest('section')!;
    expect(within(health).getByText('Ablation de kyste')).toBeInTheDocument();
    expect(within(health).getByText('animals.healthRecordTypes.surgery')).toBeInTheDocument();

    // Poids : le plus récent d'abord
    const weights = screen.getByRole('heading', { name: 'animals.measurements.title' }).closest('section')!;
    const rows = within(weights).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('1.45')).toBeInTheDocument();
    expect(within(rows[2]).getByText('1.2')).toBeInTheDocument();

    // RDV
    const appointments = screen.getByRole('heading', { name: 'animals.vetAppointments.title' }).closest('section')!;
    expect(within(appointments).getByText('Contrôle annuel')).toBeInTheDocument();
    expect(within(appointments).getByText('animals.vetAppointments.statusDone')).toBeInTheDocument();
    expect(within(appointments).getByText('animals.vetAppointments.statusCancelled')).toBeInTheDocument();

    // Contacts : vétérinaires dédoublonnés sans tenir compte de la casse
    const contacts = screen.getByRole('heading', { name: 'carnetPrint.contacts' }).closest('section')!;
    expect(within(contacts).getAllByRole('listitem')).toHaveLength(2);
    expect(within(contacts).getByText(/Clinique des Lilas/)).toBeInTheDocument();
  });

  it('imprime via window.print() et propose un retour vers la fiche animal', async () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => {});
    render(<CarnetPrintPage />);

    const button = await screen.findByRole('button', { name: 'carnetPrint.print' });
    fireEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('link', { name: /carnetPrint\.back/ })).toHaveAttribute('href', '/mes-animaux/animal-1');
    // Les commandes ne sont pas imprimées ; la feuille A4 masque l'en-tête et le pied du site.
    expect(button.closest('.carnet-noprint')).not.toBeNull();
    const css = document.querySelector('style')?.textContent ?? '';
    expect(css).toContain('size:A4');
    expect(css).toContain('@media print');
    print.mockRestore();
  });

  it('affiche des états vides lisibles sans données', async () => {
    getCarnetExport.mockResolvedValue({ exportedAt: carnet.exportedAt, animal: { id: 'a', name: 'Nala', speciesId: 1 }, sections: {} });
    getSpecies.mockRejectedValue(new Error('offline'));
    render(<CarnetPrintPage />);

    await screen.findByText('Nala');
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('animals.vaccinations.noData')).toBeInTheDocument();
    expect(screen.getByText('carnetPrint.noTreatments')).toBeInTheDocument();
    expect(screen.getByText('animals.healthRecordEmpty')).toBeInTheDocument();
    expect(screen.getByText('animals.measurements.noData')).toBeInTheDocument();
    expect(screen.getByText('animals.vetAppointments.noData')).toBeInTheDocument();
    expect(screen.getByText('carnetPrint.noContacts')).toBeInTheDocument();
    expect(screen.queryByText('carnetPrint.microchip')).not.toBeInTheDocument();
  });

  it.each([
    [403, 'animals.carnet.premiumRequired'],
    [404, 'animals.notFound'],
    [500, 'carnetPrint.loadError'],
  ])('gère l\'erreur %i', async (status, message) => {
    getCarnetExport.mockRejectedValue(Object.assign(new Error('x'), { status }));
    render(<CarnetPrintPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: 'carnetPrint.print' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /carnetPrint\.back/ })).toBeInTheDocument();
  });

  it('redirige vers la connexion sans session', async () => {
    mockAuth = { user: null, token: null, isLoading: false };
    render(<CarnetPrintPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(getCarnetExport).not.toHaveBeenCalled();
  });
});
