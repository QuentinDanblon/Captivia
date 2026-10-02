import { ApiError } from '../api';
import {
  isGuestAccountError,
  isGuestBannerSnoozed,
  isGuestUser,
  snoozeGuestBanner,
  startGuestSession,
  upgradeGuestAccount,
} from '../guest';
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from '../session';

global.fetch = jest.fn();
const fetchMock = () => global.fetch as jest.Mock;

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  json: async () => body,
});

const guestUser = { id: 'g1', email: null, isGuest: true, locale: 'fr', isPremium: false, emailVerified: false };

/** Mode invité : session sans compte, conversion sans perte, refus « réservé aux comptes ». */
describe('lib/guest', () => {
  beforeEach(() => {
    fetchMock().mockReset();
    localStorage.clear();
  });

  it('startGuestSession : POST /auth/guest avec la locale, renvoie la paire de jetons', async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse(201, { accessToken: 'guest-access', refreshToken: 'guest-refresh', user: guestUser }),
    );

    const session = await startGuestSession('de');

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/guest$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ locale: 'de' });
    expect(session).toMatchObject({ accessToken: 'guest-access', refreshToken: 'guest-refresh' });
    expect(isGuestUser(session.user)).toBe(true);
  });

  it('startGuestSession : 429 → ApiError(429)', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(429, { statusCode: 429, message: 'Trop de requêtes' }));
    await expect(startGuestSession()).rejects.toMatchObject({ status: 429 });
  });

  it('upgradeGuestAccount : Bearer de l’invité, corps de l’inscription, nouvelle paire', async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse(201, {
        accessToken: 'account-access',
        refreshToken: 'account-refresh',
        user: { ...guestUser, email: 'kaa@example.com', isGuest: false },
      }),
    );
    const input = { email: 'kaa@example.com', password: 'Password123!', locale: 'fr', acceptTerms: true, ageConfirmed: true };

    const session = await upgradeGuestAccount('guest-access', input);

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/upgrade$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer guest-access');
    expect(JSON.parse(String(init.body))).toEqual(input);
    expect(session.user).toMatchObject({ email: 'kaa@example.com', isGuest: false });
  });

  it('upgradeGuestAccount : 409 (adresse prise) → ApiError(409), aucune fusion côté client', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(409, { statusCode: 409, message: 'Email already registered' }));
    const err = await upgradeGuestAccount('guest-access', {
      email: 'taken@example.com',
      password: 'Password123!',
      acceptTerms: true,
      ageConfirmed: true,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
  });

  it('upgradeGuestAccount : access token expiré → rafraîchi puis rejoué une fois', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'guest-refresh');
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh', refreshToken: 'guest-refresh-2' }))
      .mockResolvedValueOnce(jsonResponse(201, { accessToken: 'account-access', user: { ...guestUser, isGuest: false } }));

    const session = await upgradeGuestAccount('expired', {
      email: 'kaa@example.com',
      password: 'Password123!',
      acceptTerms: true,
      ageConfirmed: true,
    });

    const calls = fetchMock().mock.calls as [string, RequestInit][];
    expect(calls).toHaveLength(3);
    expect(calls[1][0]).toMatch(/\/auth\/refresh$/);
    expect((calls[2][1].headers as Record<string, string>).Authorization).toBe('Bearer fresh');
    expect(session.accessToken).toBe('account-access');
  });

  it('isGuestAccountError : 403 GUEST_ACCOUNT uniquement', () => {
    expect(isGuestAccountError(new ApiError(403, 'x', 'GUEST_ACCOUNT'))).toBe(true);
    expect(isGuestAccountError(new ApiError(403, 'x', 'ANIMAL_LIMIT'))).toBe(false);
    expect(isGuestAccountError(new ApiError(403, 'x'))).toBe(false);
    expect(isGuestAccountError(new Error('GUEST_ACCOUNT'))).toBe(false);
  });

  it('bandeau « Sauvegardez vos données » : masqué 7 jours puis de retour', () => {
    const now = Date.UTC(2026, 9, 2);
    expect(isGuestBannerSnoozed(now)).toBe(false);
    snoozeGuestBanner(now);
    expect(isGuestBannerSnoozed(now + 6 * 86_400_000)).toBe(true);
    expect(isGuestBannerSnoozed(now + 8 * 86_400_000)).toBe(false);
  });
});
