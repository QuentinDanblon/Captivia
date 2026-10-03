import { isPendingStoreLink, storeLinks } from '../store-links';

describe('storeLinks', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_STORE_URL;
    delete process.env.NEXT_PUBLIC_PLAY_STORE_URL;
  });

  it('marqueurs [À COMPLÉTER] tant que les fiches ne sont pas publiées', () => {
    const links = storeLinks();
    expect(links.map((l) => l.name)).toEqual(['App Store', 'Google Play']);
    expect(links.every(isPendingStoreLink)).toBe(true);
    expect(links[0].href).toBe('[À COMPLÉTER : lien App Store]');
  });

  it('URL https renseignées ; une valeur non https reste à compléter', () => {
    process.env.NEXT_PUBLIC_APP_STORE_URL = 'https://apps.apple.com/app/id0000000000';
    process.env.NEXT_PUBLIC_PLAY_STORE_URL = 'http://play.google.com/store/apps/details?id=app.captivia';
    const [appStore, play] = storeLinks();
    expect(appStore.href).toBe('https://apps.apple.com/app/id0000000000');
    expect(isPendingStoreLink(appStore)).toBe(false);
    expect(isPendingStoreLink(play)).toBe(true);
  });
});
