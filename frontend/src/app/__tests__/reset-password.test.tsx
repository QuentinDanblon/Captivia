import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const resetPassword = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { resetPassword: (...args: unknown[]) => resetPassword(...args) },
}));

let mockQuery = 'token=SECRET-TOKEN';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

// La page utilise la navigation localisée de next-intl (ESM, non chargeable sous jest).
jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import ResetPasswordPage from '../[locale]/reset-password/page';

describe('reset-password page', () => {
  beforeEach(() => {
    resetPassword.mockReset();
    resetPassword.mockResolvedValue({ message: 'ok' });
    mockQuery = 'token=SECRET-TOKEN';
    window.history.replaceState(null, '', '/reset-password?token=SECRET-TOKEN');
  });

  it("retire le token de l'URL mais l'utilise toujours à la soumission", async () => {
    const { container } = render(<ResetPasswordPage />);

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.href).not.toContain('SECRET-TOKEN');

    const [pwd, confirm] = Array.from(container.querySelectorAll('input[type="password"]'));
    fireEvent.change(pwd, { target: { value: 'a-valid-password-1' } });
    fireEvent.change(confirm, { target: { value: 'a-valid-password-1' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('SECRET-TOKEN', 'a-valid-password-1'));
    // Le reset révoque aussi le lien calendrier et le push : l'utilisateur en est informé.
    expect(await screen.findByText('sessions.accessRevokedNotice')).toBeInTheDocument();
  });

  it('refuse un mot de passe de moins de 10 caractères', async () => {
    const { container } = render(<ResetPasswordPage />);
    const [pwd, confirm] = Array.from(container.querySelectorAll('input[type="password"]'));
    expect(pwd).toHaveAttribute('minLength', '10');

    fireEvent.change(pwd, { target: { value: '123456789' } });
    fireEvent.change(confirm, { target: { value: '123456789' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('auth.passwordMin')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
