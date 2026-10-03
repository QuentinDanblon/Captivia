import { cleanText, containsLink, isNewAccount } from './text-filters';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('containsLink', () => {
  it.each([
    'Voir https://exemple.org/page',
    'http://spam.test',
    'rendez-vous sur www.promo-reptiles.com',
    'achetez sur reptiles-pas-chers.shop maintenant',
    'Contact : mailto:a@b.c',
    'écrivez-moi sur gecko.fr/annonce',
    'HTTPS://EXEMPLE.COM',
    'ｗｗｗ.exemple.com',
  ])('détecte un lien dans %p', (t) => {
    expect(containsLink(t)).toBe(true);
  });

  it.each([
    'Mon gecko pèse 1.5 kg et mange 3 grillons.',
    'Température 28.5 °C, hygrométrie 60 %.',
    'Ex. : un terrarium 90x45x45, etc.',
    'Merci ! À bientôt.',
    'Version 2.0 du terrarium',
  ])('ne voit pas de lien dans %p', (t) => {
    expect(containsLink(t)).toBe(false);
  });
});

describe('isNewAccount', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  it('vrai avant 7 jours, faux ensuite', () => {
    expect(isNewAccount(new Date(now.getTime() - 6 * DAY_MS), now)).toBe(true);
    expect(isNewAccount(new Date(now.getTime() - 7 * DAY_MS), now)).toBe(false);
  });
});

describe('cleanText', () => {
  it('retire les caractères de contrôle, unifie les fins de ligne et rogne', () => {
    expect(cleanText('  a\r\nb\u0000c\u0007\td  ')).toBe('a\nbc\td');
    expect(cleanText(undefined)).toBe('');
  });

  it('laisse le HTML tel quel (texte brut, échappé à l’affichage)', () => {
    expect(cleanText('<b>gras</b>')).toBe('<b>gras</b>');
  });
});
