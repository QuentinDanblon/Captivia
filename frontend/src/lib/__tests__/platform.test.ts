import { animalDetailPath, isNative, openExternal, publicAnimalPath, speciesPath, tokenStorage } from '../platform';

describe('platform (web)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("n'est pas natif dans jsdom", () => {
    expect(isNative()).toBe(false);
  });

  it('garde les chemins dynamiques web hors build mobile', () => {
    expect(animalDetailPath(42)).toBe('/mes-animaux/42');
    expect(speciesPath('7')).toBe('/species/7');
    expect(publicAnimalPath('a b')).toBe('/animal-public/a%20b');
  });

  it("openExternal n'ouvre que des URL http(s), sans opener", () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    expect(openExternal('javascript:alert(1)')).toBe(false);
    expect(openExternal('pas une url')).toBe(false);
    expect(openExternal('https://www.amazon.fr/dp/B000?tag=x')).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('https://www.amazon.fr/dp/B000?tag=x', '_blank', 'noopener,noreferrer');
  });

  it('tokenStorage se comporte comme localStorage sur le web', async () => {
    tokenStorage.setItem('token', 'abc');
    expect(localStorage.getItem('token')).toBe('abc');
    expect(tokenStorage.getItem('token')).toBe('abc');
    await tokenStorage.hydrate(['token']);
    expect(tokenStorage.getItem('token')).toBe('abc');
    tokenStorage.removeItem('token');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
