import { deleteMyAccount, exportMyData } from '../account-api';
import { API_URL } from '../config';

global.fetch = jest.fn();
const fetchMock = () => global.fetch as jest.Mock;

describe('account-api', () => {
  const logoutListener = jest.fn();

  beforeEach(() => {
    fetchMock().mockReset();
    logoutListener.mockClear();
    window.addEventListener('auth:logout', logoutListener);
  });
  afterEach(() => window.removeEventListener('auth:logout', logoutListener));

  it("utilise l'API_URL normalisée de config et un signal de timeout", async () => {
    fetchMock().mockResolvedValue({ ok: true, blob: async () => new Blob(['{}']) });
    await exportMyData('tok');
    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/export`);
    expect(init.signal).toBeDefined();
  });

  it('DELETE 401 (mot de passe incorrect) lève AccountApiError sans émettre auth:logout', async () => {
    fetchMock().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Mot de passe incorrect' }),
    });
    await expect(deleteMyAccount('tok', 'bad')).rejects.toMatchObject({
      name: 'AccountApiError',
      status: 401,
    });
    expect(logoutListener).not.toHaveBeenCalled();
  });

  it('erreur réseau -> AccountApiError status 0', async () => {
    fetchMock().mockRejectedValue(new TypeError('fetch failed'));
    await expect(deleteMyAccount('tok', 'x')).rejects.toMatchObject({ status: 0 });
  });
});
