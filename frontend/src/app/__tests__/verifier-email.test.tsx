import { render, screen, waitFor } from '@testing-library/react';

const verifyEmail = jest.fn();
const getProfile = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    verifyEmail: (...args: unknown[]) => verifyEmail(...args),
    getProfile: (...args: unknown[]) => getProfile(...args),
  },
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=VERIF-TOKEN'),
}));

jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const setUser = jest.fn();
const sessionUser = { id: 'u1', email: 'moi@ex.fr', locale: 'fr', isPremium: false, emailVerified: false };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: sessionUser, token: 'access-1', setUser }),
}));

import VerifyEmailPage from '../[locale]/verifier-email/page';

/** Revue frontend, constat 12 : le profil est rechargé, `emailVerified` n'est jamais forcé. */
describe('verifier-email page', () => {
  beforeEach(() => {
    verifyEmail.mockReset().mockResolvedValue({ message: 'ok', emailVerified: true });
    getProfile.mockReset();
    setUser.mockReset();
    localStorage.clear();
  });

  it('recharge /auth/me après succès et applique la réponse du backend', async () => {
    // Le lien concernait un autre compte : le compte connecté reste non vérifié.
    getProfile.mockResolvedValue({ ...sessionUser, emailVerified: false });

    render(<VerifyEmailPage />);

    await waitFor(() => expect(getProfile).toHaveBeenCalledWith('access-1'));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith({ ...sessionUser, emailVerified: false }));
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ emailVerified: false });
    expect(setUser).not.toHaveBeenCalledWith(expect.objectContaining({ emailVerified: true }));
    expect(screen.getByRole('status')).toHaveTextContent('success');
  });

  it('profil indisponible : rien n’est modifié localement', async () => {
    getProfile.mockRejectedValue(new Error('down'));

    render(<VerifyEmailPage />);

    await waitFor(() => expect(getProfile).toHaveBeenCalled());
    expect(setUser).not.toHaveBeenCalled();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('lien invalide : aucun rechargement du profil', async () => {
    verifyEmail.mockRejectedValue(new Error('invalid'));

    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('invalid'));
    expect(getProfile).not.toHaveBeenCalled();
  });
});
