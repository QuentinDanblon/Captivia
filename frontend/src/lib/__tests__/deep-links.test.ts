// i18n/routing importe next-intl (ESM) : mêmes valeurs que la configuration réelle.
jest.mock('../../../i18n/routing', () => ({
  routing: { locales: ['fr', 'en', 'es', 'de', 'it', 'pt'], defaultLocale: 'fr' },
}));

import { APP_HOME_PATH, appRoute, defaultAllowedHosts, mapWebUrlToAppRoute } from '../deep-links';

const SITE = 'https://captivia-app.netlify.app';
const map = (path: string, locale?: string) => mapWebUrlToAppRoute(`${SITE}${path}`, { locale });

it('le mock des locales suit i18n/routing.ts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src: string = require('fs').readFileSync(require('path').join(__dirname, '../../../i18n/routing.ts'), 'utf8');
  expect(src).toMatch(/locales:\s*\['fr', 'en', 'es', 'de', 'it', 'pt'\]/);
  expect(src).toMatch(/defaultLocale:\s*'fr'/);
});

describe('appRoute', () => {
  it('préfixe la locale et ajoute la barre finale des fichiers exportés', () => {
    expect(appRoute('fr', '/agenda')).toBe('/fr/agenda/');
    expect(appRoute('en', '/mes-animaux/detail?id=1')).toBe('/en/mes-animaux/detail/?id=1');
    expect(appRoute('de', '/')).toBe('/de/');
    expect(appRoute('it', 'species?id=7')).toBe('/it/species/?id=7');
  });

  it('retombe sur la locale par défaut pour une locale inconnue', () => {
    expect(appRoute('xx', '/agenda')).toBe('/fr/agenda/');
  });

  it("ignore une query vide et les barres en trop", () => {
    expect(appRoute('fr', '/agenda?')).toBe('/fr/agenda/');
    expect(appRoute('fr', '//agenda//')).toBe('/fr/agenda/');
  });
});

describe('defaultAllowedHosts', () => {
  it("contient l'hôte du site et sa variante www", () => {
    const hosts = defaultAllowedHosts();
    expect(hosts).toContain('captivia-app.netlify.app');
    expect(hosts).toContain('www.captivia-app.netlify.app');
  });
});

describe('mapWebUrlToAppRoute — fiches et pages dynamiques', () => {
  it('fiche animal sans préfixe (français, locale par défaut du site)', () => {
    expect(map('/mes-animaux/clx123abc')).toBe('/fr/mes-animaux/detail/?id=clx123abc');
  });

  it('fiche animal avec préfixe de locale', () => {
    expect(map('/en/mes-animaux/clx123abc')).toBe('/en/mes-animaux/detail/?id=clx123abc');
    expect(map('/pt/mes-animaux/abc/')).toBe('/pt/mes-animaux/detail/?id=abc');
  });

  it("sans préfixe, reprend la locale courante de l'app", () => {
    expect(map('/mes-animaux/abc', 'es')).toBe('/es/mes-animaux/detail/?id=abc');
    expect(map('/mes-animaux/abc', 'zz')).toBe('/fr/mes-animaux/detail/?id=abc');
  });

  it("le préfixe de l'URL l'emporte sur la locale de l'app", () => {
    expect(map('/de/species/2435099', 'es')).toBe('/de/species/?id=2435099');
  });

  it('carnet imprimable', () => {
    expect(map('/mes-animaux/abc/carnet')).toBe('/fr/mes-animaux/carnet/?id=abc');
    expect(map('/it/mes-animaux/abc/carnet')).toBe('/it/mes-animaux/carnet/?id=abc');
  });

  it("formes déjà converties de l'app", () => {
    expect(map('/fr/mes-animaux/detail?id=abc')).toBe('/fr/mes-animaux/detail/?id=abc');
    expect(map('/mes-animaux/carnet/?id=abc')).toBe('/fr/mes-animaux/carnet/?id=abc');
    expect(map('/species?id=12')).toBe('/fr/species/?id=12');
    expect(map('/animal-public/?slug=kaa-7f3')).toBe('/fr/animal-public/?slug=kaa-7f3');
  });

  it('fiche espèce', () => {
    expect(map('/species/2435099')).toBe('/fr/species/?id=2435099');
    expect(map('/en/species/2435099')).toBe('/en/species/?id=2435099');
  });

  it('page publique (QR code)', () => {
    expect(map('/animal-public/kaa-7f3')).toBe('/fr/animal-public/?slug=kaa-7f3');
    expect(map('/es/animal-public/kaa-7f3')).toBe('/es/animal-public/?slug=kaa-7f3');
  });

  it('conserve une ancre de section sûre, ignore les autres', () => {
    expect(map('/species/12#sante')).toBe('/fr/species/?id=12#sante');
    expect(map('/species/12#<script>')).toBe('/fr/species/?id=12');
  });

  it('identifiants invalides → accueil', () => {
    expect(map('/mes-animaux/a%20b')).toBe('/fr/mes-animaux/');
    expect(map('/mes-animaux/detail')).toBe('/fr/mes-animaux/');
    expect(map('/mes-animaux/detail?id=../x')).toBe('/fr/mes-animaux/');
    expect(map('/species/<x>')).toBe('/fr/mes-animaux/');
    expect(map('/animal-public')).toBe('/fr/mes-animaux/');
    expect(map(`/species/${'1'.repeat(200)}`)).toBe('/fr/mes-animaux/');
    expect(map('/mes-animaux/abc/autre')).toBe('/fr/mes-animaux/');
  });

  it('segment mal encodé → accueil', () => {
    expect(map('/mes-animaux/%E0%A4%A')).toBe('/fr/mes-animaux/');
  });
});

describe('mapWebUrlToAppRoute — jetons', () => {
  it('réinitialisation du mot de passe', () => {
    expect(map('/reset-password?token=abc.DEF_123-x')).toBe('/fr/reset-password/?token=abc.DEF_123-x');
    expect(map('/en/reset-password?token=t0k')).toBe('/en/reset-password/?token=t0k');
  });

  it("vérification de l'adresse e-mail", () => {
    expect(map('/verifier-email?token=t0k')).toBe('/fr/verifier-email/?token=t0k');
    expect(map('/de/verifier-email/?token=t0k')).toBe('/de/verifier-email/?token=t0k');
  });

  it('écarte les paramètres étrangers et les jetons invalides', () => {
    expect(map('/reset-password?token=abc&next=https://evil.example')).toBe('/fr/reset-password/?token=abc');
    expect(map('/reset-password?token=a%20b')).toBe('/fr/reset-password/');
    expect(map('/verifier-email')).toBe('/fr/verifier-email/');
  });
});

describe('mapWebUrlToAppRoute — pages statiques', () => {
  it('catalogue des espèces, avec sa recherche', () => {
    expect(map('/especes')).toBe('/fr/especes/');
    expect(map('/en/especes?q=boa&groupe=reptiles&x=1')).toBe('/en/especes/?q=boa&groupe=reptiles');
  });

  it("pages de l'app", () => {
    expect(map('/agenda')).toBe('/fr/agenda/');
    expect(map('/mes-animaux')).toBe('/fr/mes-animaux/');
    expect(map('/mes-animaux/liste')).toBe('/fr/mes-animaux/liste/');
    expect(map('/it/parametres/notifications')).toBe('/it/parametres/notifications/');
    expect(map('/login')).toBe('/fr/login/');
  });

  it('ignore la query des pages qui ne la lisent pas', () => {
    expect(map('/agenda?utm_source=mail')).toBe('/fr/agenda/');
  });

  it('accepte index.html et les barres finales', () => {
    expect(map('/en/agenda/index.html')).toBe('/en/agenda/');
    expect(map('/agenda/')).toBe('/fr/agenda/');
  });
});

describe('mapWebUrlToAppRoute — chemins inconnus', () => {
  it("renvoient vers l'accueil de l'app", () => {
    expect(map('/')).toBe(`/fr${APP_HOME_PATH}/`);
    expect(map('/en')).toBe('/en/mes-animaux/');
    expect(map('/en/')).toBe('/en/mes-animaux/');
    expect(map('/cgu')).toBe('/fr/mes-animaux/');
    expect(map('/n-importe-quoi/vraiment')).toBe('/fr/mes-animaux/');
    expect(map('/xx/agenda')).toBe('/fr/mes-animaux/');
    expect(map('/inconnu', 'pt')).toBe('/pt/mes-animaux/');
  });
});

describe('mapWebUrlToAppRoute — refus', () => {
  it('refuse les domaines étrangers', () => {
    expect(mapWebUrlToAppRoute('https://evil.example/mes-animaux/abc')).toBeNull();
    expect(mapWebUrlToAppRoute('https://captivia-app.netlify.app.evil.example/agenda')).toBeNull();
    expect(mapWebUrlToAppRoute('https://evil-captivia-app.netlify.app/agenda')).toBeNull();
  });

  it('refuse les schémas non http(s) et les URL invalides', () => {
    expect(mapWebUrlToAppRoute('javascript:alert(1)')).toBeNull();
    expect(mapWebUrlToAppRoute('captivia://mes-animaux/abc')).toBeNull();
    expect(mapWebUrlToAppRoute('file:///etc/passwd')).toBeNull();
    expect(mapWebUrlToAppRoute('pas une url')).toBeNull();
    expect(mapWebUrlToAppRoute('')).toBeNull();
  });

  it("refuse les URL avec identifiants d'accès", () => {
    expect(mapWebUrlToAppRoute(`https://user:pw@captivia-app.netlify.app/agenda`)).toBeNull();
  });

  it("accepte la variante www et l'hôte en majuscules", () => {
    expect(mapWebUrlToAppRoute('https://www.captivia-app.netlify.app/agenda')).toBe('/fr/agenda/');
    expect(mapWebUrlToAppRoute('https://CAPTIVIA-APP.netlify.app/agenda')).toBe('/fr/agenda/');
  });

  it('respecte une liste d’hôtes fournie', () => {
    const opts = { allowedHosts: ['captivia.app'] };
    expect(mapWebUrlToAppRoute('https://captivia.app/species/1', opts)).toBe('/fr/species/?id=1');
    expect(mapWebUrlToAppRoute(`${SITE}/species/1`, opts)).toBeNull();
  });
});
