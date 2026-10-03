import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockIsNative = jest.fn(() => false);
jest.mock('@/lib/platform', () => ({
  useIsNative: () => mockIsNative(),
}));

let mockOnActivated: (() => void) | undefined;
jest.mock('@/components/purchases/NativePaywall', () => ({
  NativePaywall: ({ onActivated }: { onActivated?: () => void }) => {
    mockOnActivated = onActivated;
    return <p>paywall natif</p>;
  },
}));

import { AddAnimalLockedSlot } from '../guest/AddAnimalLockedSlot';

beforeEach(() => {
  mockIsNative.mockReturnValue(false);
  mockOnActivated = undefined;
});

describe('AddAnimalLockedSlot', () => {
  it('web, compte gratuit : lien vers la page abonnement (aucun achat sur le site)', () => {
    render(<AddAnimalLockedSlot isGuest={false} />);
    expect(screen.getByRole('link', { name: 'lockedActionFree' })).toHaveAttribute('href', '/parametres/abonnement');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('invité (web ou app) : création de compte d’abord', () => {
    mockIsNative.mockReturnValue(true);
    render(<AddAnimalLockedSlot isGuest />);
    expect(screen.getByRole('link', { name: 'lockedActionGuest' })).toHaveAttribute('href', '/sauvegarder');
    expect(screen.queryByText('paywall natif')).toBeNull();
  });

  it('app native, compte gratuit : ouvre le paywall sur place, refermé dès l’activation', async () => {
    mockIsNative.mockReturnValue(true);
    render(<AddAnimalLockedSlot isGuest={false} />);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'lockedActionFree' }));
    expect(await screen.findByRole('dialog', { name: 'modalTitle' })).toBeInTheDocument();
    expect(screen.getByText('paywall natif')).toBeInTheDocument();
    act(() => mockOnActivated?.());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
