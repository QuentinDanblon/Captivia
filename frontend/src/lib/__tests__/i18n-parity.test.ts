/**
 * Parité i18n : fr.json est la référence.
 *  (a) toutes les langues ont exactement les mêmes clés (pour les namespaces de fr.json) ;
 *  (b) les arguments ICU ({name}, {count, plural, ...}) et le balisage sont identiques à fr ;
 *  (c) aucune valeur n'est restée identique au français hors liste blanche.
 * Le test compare dynamiquement : un nouveau namespace ajouté dans fr.json est
 * automatiquement vérifié dans les autres langues.
 */
import fs from 'fs';
import path from 'path';

const MESSAGES_DIR = path.join(__dirname, '..', '..', '..', 'messages');
const REFERENCE = 'fr';
const LOCALES = ['en', 'es', 'de', 'it', 'pt'] as const;

type Messages = { [key: string]: string | Messages };

const load = (locale: string): Messages =>
  JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));

const flatten = (obj: Messages, prefix = '', out: Record<string, string> = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') flatten(value, full, out);
    else out[full] = String(value);
  }
  return out;
};

const fr = flatten(load(REFERENCE));
const messages: Record<string, Record<string, string>> = Object.fromEntries(
  LOCALES.map((l) => [l, flatten(load(l))]),
);
const frNamespaces = new Set(Object.keys(fr).map((k) => k.split('.')[0]));
const inFrNamespace = (key: string) => frNamespaces.has(key.split('.')[0]);

/**
 * Liste blanche : valeurs légitimement identiques au français.
 * - ALLOWED_EVERYWHERE : noms propres, sigles, unités, prix/formats neutres.
 * - ALLOWED_PER_LOCALE : mots identiques (cognats ou emprunts) dans la langue cible.
 */
const ALLOWED_EVERYWHERE = new Set([
  'Captivia',
  'UVB',
  '+100 pts',
  // Formule gratuite ; aucun prix d'abonnement codé en dur (tarif des stores, via RevenueCat).
  '0 €',
  'CC BY-SA 4.0',
  'GBIF.org',
  // Noms de stores (W6-08)
  'App Store',
  'Google Play',
  // Nom de l'offre payante (mention PremiumBadge du mode invité, tableau des formules de la landing)
  'Premium',
  // Fiches espèces : installations et matériel au nom international, crédit des photos GBIF
  'Terrarium',
  'Aquarium',
  'Aquaterrarium',
  'Thermostat',
  'via GBIF',
]);

const ALLOWED_PER_LOCALE: Record<(typeof LOCALES)[number], Set<string>> = {
  en: new Set([
    'Reptiles',
    'Active', 'Bronze', 'Classification', 'Contact', 'Date', 'Description', 'Distribution',
    'Dose', 'Email', 'Grade', 'Habitat', 'Identification', 'Notes', 'Notifications',
    'Photos', 'Points', 'Restrictions', 'Routines', 'Type', 'Vaccinations',
    'Reptile', 'Bivalve', 'Animal', 'Biome', 'Sources', 'Tropical / Subtropical',
    'Urgent',
    // « point(s) » s'écrit de même en anglais (grade).
    '{count, plural, one {# point} other {# points}}',
    '{count, plural, one {+# point} other {+# points}}',
    // Fiches espèces (régime, matériel, crédit photo)
    'Carnivore', 'Herbivore', 'Insectivore', 'Omnivore', 'Cage', 'Filtration', 'Photo', 'Budget',
  ]),
  es: new Set(['Email', 'Reptiles', 'Animal', 'Tropical / Subtropical']),
  de: new Set(['Bronze', 'Diamant', 'Profil', 'Rang']),
  it: new Set(['Dose', 'Email', 'Facile', 'Habitat', 'Bivalve', 'Budget', 'Classe']),
  pt: new Set([
    'Bronze', 'Dose', 'Email', 'Habitat', 'ex. Rango', 'ou', 'Wikipédia',
    'Bivalve', 'Animal', 'Tropical / Subtropical', 'Classe',
  ]),
};

/** Extrait les noms d'arguments ICU (récursivement dans plural/select) et les balises. */
const extractArgs = (message: string): string[] => {
  const names = new Set<string>();

  const parse = (text: string) => {
    let i = 0;
    while (i < text.length) {
      if (text[i] !== '{') {
        i++;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const inner = text.slice(i + 1, j - 1);
      const [name, type, ...rest] = inner.split(',');
      names.add(name.trim());
      if (type && /^(plural|select|selectordinal)$/.test(type.trim())) {
        // Corps des branches : {…} imbriqués après le sélecteur
        const branches = rest.join(',');
        let k = 0;
        while (k < branches.length) {
          if (branches[k] !== '{') {
            k++;
            continue;
          }
          let d = 1;
          let m = k + 1;
          while (m < branches.length && d > 0) {
            if (branches[m] === '{') d++;
            else if (branches[m] === '}') d--;
            m++;
          }
          parse(branches.slice(k + 1, m - 1));
          k = m;
        }
      }
      i = j;
    }
  };

  parse(message);
  const tags = message.match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
  return [...[...names].map((n) => `{${n}}`), ...tags].sort();
};

const hasLetters = (value: string) => /\p{L}/u.test(value);

describe('i18n parity (reference: fr)', () => {
  it('loads a non-trivial reference', () => {
    expect(Object.keys(fr).length).toBeGreaterThan(400);
  });

  describe.each(LOCALES)('%s', (locale) => {
    const target = messages[locale];

    it('has exactly the same keys as fr (for fr namespaces)', () => {
      const frKeys = Object.keys(fr).sort();
      const targetKeys = Object.keys(target).filter(inFrNamespace).sort();
      const missing = frKeys.filter((k) => !(k in target));
      const extra = targetKeys.filter((k) => !(k in fr));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it('keeps ICU placeholders and markup identical to fr', () => {
      const mismatches = Object.keys(fr)
        .filter((k) => k in target)
        .filter((k) => extractArgs(fr[k]).join('|') !== extractArgs(target[k]).join('|'))
        .map((k) => ({ key: k, fr: fr[k], [locale]: target[k] }));
      expect(mismatches).toEqual([]);
    });

    it('has no value left identical to fr outside the whitelist', () => {
      const untranslated = Object.keys(fr)
        .filter((k) => k in target && target[k] === fr[k])
        .filter((k) => hasLetters(fr[k]))
        .filter((k) => !ALLOWED_EVERYWHERE.has(fr[k]) && !ALLOWED_PER_LOCALE[locale].has(fr[k]))
        .map((k) => `${k} = ${fr[k]}`);
      expect(untranslated).toEqual([]);
    });
  });
});
