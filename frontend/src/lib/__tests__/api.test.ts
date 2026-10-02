import { api, ApiError, isBackendUnavailable, BACKEND_UNAVAILABLE_MESSAGE } from '../api';

// Mock fetch
global.fetch = jest.fn();

const fetchMock = () => global.fetch as jest.Mock;

/** Vérifie que le premier argument du dernier appel fetch contient la sous-chaîne attendue. */
const expectFetchUrl = (substring: string) => {
  const [url] = fetchMock().mock.calls.at(-1) ?? [];
  expect(String(url)).toContain(substring);
};

describe('API Client', () => {
  beforeEach(() => {
    fetchMock().mockClear();
  });

  describe('Species endpoints', () => {
    it('searchSpecies should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [], total: 0 }),
      });

      await api.searchSpecies('boa', 20, 0);

      expectFetchUrl('/species/search?q=boa&limit=20&offset=0');
    });

    it('getSpecies should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123, name: 'Test Species' }),
      });

      await api.getSpecies('123');

      expectFetchUrl('/species/123');
    });

    it('getVernacularNames should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await api.getVernacularNames('123');

      expectFetchUrl('/species/123/vernacular');
    });
  });

  describe('Health endpoints', () => {
    it('getSpeciesHealth should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ speciesId: 123, editorial: null }),
      });

      await api.getSpeciesHealth('123', 'respiratory', 'fr');

      expectFetchUrl('/species/123/health?disease=respiratory&locale=fr');
    });
  });

  describe('Animals endpoints (with auth)', () => {
    const mockToken = 'test-token-123';

    it('getMyAnimals should include Authorization header', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await api.getMyAnimals(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/animals'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it('createAnimal should POST with correct data', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'animal-123' }),
      });

      const animalData = {
        speciesId: 123,
        name: 'Rex',
        sex: 'male',
      };

      await api.createAnimal(animalData, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/animals'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(animalData),
        }),
      );
    });

    it('updateAnimal should PATCH with correct data', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'animal-123' }),
      });

      const updateData = { name: 'Updated Name' };

      await api.updateAnimal('animal-123', updateData, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/animals/animal-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        }),
      );
    });

    it('deleteAnimal should DELETE with auth header', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await api.deleteAnimal('animal-123', mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/animals/animal-123'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });
  });

  describe('Routines endpoints', () => {
    const mockToken = 'test-token-123';

    it('getAnimalRoutines should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await api.getAnimalRoutines('animal-123', mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/animals/animal-123/routines'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it('createRoutine should POST with correct data', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'routine-123' }),
      });

      const routineData = {
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '08:00' },
      };

      await api.createRoutine('animal-123', routineData, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/animals/animal-123/routines'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(routineData),
        }),
      );
    });
  });

  describe('Auth endpoints', () => {
    it('register should POST registration data', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'token', user: {} }),
      });

      await api.register('test@captivia.com', 'password123', 'fr');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@captivia.com',
            password: 'password123',
            locale: 'fr',
          }),
        }),
      );
    });

    it('login should POST login credentials', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'token', user: {} }),
      });

      await api.login('test@captivia.com', 'password123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@captivia.com',
            password: 'password123',
          }),
        }),
      );
    });

    it('getProfile should include Authorization header', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'user-123' }),
      });

      await api.getProfile('test-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });
  });

  describe('Error handling', () => {
    it('should throw error when response is not ok', async () => {
      fetchMock().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(api.getSpecies('999999')).rejects.toThrow();
    });
  });

  describe('Food endpoints', () => {
    it('searchFood should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ products: [] }),
      });

      await api.searchFood('dog food', 'wet');

      expectFetchUrl('/food/search?q=dog');
    });
  });

  describe('Equipment endpoints', () => {
    it('getRecommendedEquipment should call correct endpoint', async () => {
      fetchMock().mockResolvedValue({
        ok: true,
        json: async () => ({ recommendations: [] }),
      });

      await api.getRecommendedEquipment(123, 'terrarium', 'large');

      expectFetchUrl('/equipment?speciesId=123&category=terrarium&size=large');
    });
  });

  describe('request() : erreurs HTTP, timeout et session', () => {
    const jsonResponse = (status: number, body: unknown, statusText = '') => ({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: async () => body,
    });
    let logoutListener: jest.Mock;

    beforeEach(() => {
      logoutListener = jest.fn();
      window.addEventListener('auth:logout', logoutListener);
    });
    afterEach(() => {
      window.removeEventListener('auth:logout', logoutListener);
    });

    it('lève ApiError avec status et message du backend sur une réponse non OK', async () => {
      fetchMock().mockResolvedValue(jsonResponse(404, { message: 'Espèce introuvable' }, 'Not Found'));

      const err = await api.getSpecies('999').catch((e) => e);

      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
      expect(err.message).toBe('Espèce introuvable');
    });

    it('concatène les messages de validation (tableau) et retombe sur statusText', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(400, { message: ['nom requis', 'sexe invalide'] }));
      await expect(api.getSpecies('1')).rejects.toThrow('nom requis ; sexe invalide');

      fetchMock().mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) });
      await expect(api.getSpecies('1')).rejects.toMatchObject({ status: 500, message: 'Internal Server Error' });
    });

    it('migre les anciens return response.json() : une 500 sur un appel authentifié lève désormais', async () => {
      fetchMock().mockResolvedValue(jsonResponse(500, { message: 'boom' }));
      await expect(api.getMyAnimals('tok')).rejects.toMatchObject({ status: 500, message: 'boom' });
      await expect(api.getGrade('tok')).rejects.toBeInstanceOf(ApiError);
    });

    it('transmet un AbortSignal de timeout (15 s) à fetch', async () => {
      fetchMock().mockResolvedValue(jsonResponse(200, {}));
      await api.getSpecies('1');
      const [, init] = fetchMock().mock.calls.at(-1);
      expect(init.signal).toBeDefined();
      expect(typeof init.signal.aborted).toBe('boolean');
    });

    it('traduit un timeout en erreur « backend indisponible »', async () => {
      const timeout = new Error('The operation timed out.');
      timeout.name = 'TimeoutError';
      fetchMock().mockRejectedValue(timeout);

      const err = await api.getSpecies('1').catch((e) => e);

      expect(isBackendUnavailable(err)).toBe(true);
    });

    it('un échec réseau reste détectable par isBackendUnavailable avec un message neutre', async () => {
      fetchMock().mockRejectedValue(new TypeError('Failed to fetch'));

      const err = await api.getSpecies('1').catch((e) => e);

      expect(isBackendUnavailable(err)).toBe(true);
      expect(err.message).toBe(BACKEND_UNAVAILABLE_MESSAGE);
      expect(BACKEND_UNAVAILABLE_MESSAGE).not.toMatch(/3001|npm|backend &&/i);
    });

    it('émet auth:logout sur un 401 d\'une requête authentifiée', async () => {
      fetchMock().mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));

      await expect(api.getMyAnimals('expired')).rejects.toMatchObject({ status: 401 });

      expect(logoutListener).toHaveBeenCalledTimes(1);
    });

    it("n'émet JAMAIS auth:logout sur un 403 (premium requis)", async () => {
      fetchMock().mockResolvedValue(jsonResponse(403, { message: 'Premium requis' }));

      await expect(api.getMyAnimals('tok')).rejects.toMatchObject({ status: 403 });

      expect(logoutListener).not.toHaveBeenCalled();
    });

    it("n'émet pas auth:logout sur un 401 de connexion (identifiants invalides, pas de jeton)", async () => {
      fetchMock().mockResolvedValue(jsonResponse(401, { message: 'Invalid credentials' }));

      await expect(api.login('a@b.c', 'bad')).rejects.toThrow('Invalid credentials');

      expect(logoutListener).not.toHaveBeenCalled();
    });

    it("n'émet pas auth:logout quand changePassword répond 401 (mot de passe actuel incorrect)", async () => {
      fetchMock().mockResolvedValue(jsonResponse(401, { message: 'Mot de passe actuel incorrect' }));

      await expect(api.changePassword('tok', 'old', 'new')).rejects.toThrow('Mot de passe actuel incorrect');

      expect(logoutListener).not.toHaveBeenCalled();
    });

    it('getRoutineTemplates renvoie [] sur 404', async () => {
      fetchMock().mockResolvedValue(jsonResponse(404, { message: 'none' }));

      await expect(api.getRoutineTemplates('a1', 'tok')).resolves.toEqual([]);
    });
  });
});
