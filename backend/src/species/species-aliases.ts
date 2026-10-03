/**
 * Noms courants des principales espèces domestiques, en français (forme courte) et dans les
 * autres langues de l'app (en, es, de, it, pt). Le catalogue ne stocke que `commonNameFr` :
 * sans ces alias, « dog » ou « cat » ne trouvent rien et « chat » ne place pas « Chat
 * domestique » en tête. Vocabulaire courant uniquement (aucune donnée d'élevage ou de santé).
 *
 * Clé : `speciesId` de la fiche (identifiants stables du catalogue, voir seed-prod.ts).
 */
export const SPECIES_ALIASES: Readonly<Record<number, readonly string[]>> = {
  // Chien
  5287871: ['chien', 'dog', 'perro', 'hund', 'cane', 'cão'],
  // Chat domestique
  5281802: ['chat', 'cat', 'gato', 'katze', 'gatto'],
  // Lapin domestique
  5283399: ['lapin', 'rabbit', 'conejo', 'kaninchen', 'coniglio', 'coelho'],
  // Cheval domestique
  5288995: ['cheval', 'horse', 'caballo', 'pferd', 'cavallo', 'cavalo'],
  // Cochon d'Inde
  5281775: [
    'cobaye',
    'guinea pig',
    'cobaya',
    'meerschweinchen',
    "porcellino d'india",
    'porquinho-da-índia',
  ],
  // Furet domestique
  5282447: ['furet', 'ferret', 'hurón', 'frettchen', 'furetto', 'furão'],
  // Hamster doré
  5289046: ['hamster', 'golden hamster', 'hámster', 'goldhamster', 'criceto'],
  // Perruche ondulée
  5347054: [
    'perruche',
    'budgerigar',
    'budgie',
    'periquito',
    'wellensittich',
    'pappagallino ondulato',
  ],
  // Perruche calopsitte
  5347189: ['calopsitte', 'cockatiel', 'nymphensittich', 'calopsite'],
  // Canari
  5307065: ['canary', 'canario', 'kanarienvogel', 'canarino', 'canário'],
  // Poule domestique
  5228265: ['poule', 'chicken', 'hen', 'gallina', 'huhn', 'galinha'],
  // Poisson rouge
  5210786: ['goldfish', 'pez dorado', 'goldfisch', 'pesce rosso'],
  // Rat domestique
  5289003: ['rat', 'rata', 'ratte', 'ratto', 'rato'],
  // Souris blanche domestique
  5289002: ['souris', 'mouse', 'ratón', 'maus', 'topo'],
  // Gerbille
  5289028: ['gerbil', 'rennmaus', 'gerbillo'],
  // Gecko léopard
  5221172: ['leopard gecko', 'gecko leopardo', 'leopardgecko'],
  // Agame barbu
  2465641: ['bearded dragon', 'dragón barbudo', 'bartagame', 'drago barbuto'],
  // Python royal
  7587934: ['ball python', 'royal python', 'pitón real', 'königspython'],
  // Tortue d'Hermann
  2441454: ["hermann's tortoise", 'testuggine di hermann'],
  // Hérisson africain
  2437140: ['hérisson', 'hedgehog', 'erizo', 'igel', 'riccio', 'ouriço'],
  // Âne
  2440891: ['donkey', 'burro', 'esel', 'asino'],
  // Mouton
  2441110: ['sheep', 'oveja', 'schaf', 'pecora', 'ovelha'],
  // Chèvre naine
  166400276: ['chèvre', 'goat', 'cabra', 'ziege', 'capra'],
  // Cochon nain
  9104700: ['cochon', 'pig', 'mini pig', 'cerdo', 'schwein', 'maiale', 'porco'],
  // Pigeon domestique
  163312909: ['pigeon', 'paloma', 'taube', 'piccione', 'pombo'],
  // Dinde domestique
  9606290: [
    'dinde',
    'dindon',
    'turkey',
    'pavo',
    'truthahn',
    'tacchino',
    'peru',
  ],
};

/** Minuscules sans accents ni espaces superflus (comparaison tolérante). */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rangs de pertinence partagés avec la requête SQL de recherche (0 = meilleur). */
export const SEARCH_RANK = {
  EXACT: 0,
  PREFIX: 1,
  WORD_PREFIX: 2,
  CONTAINS: 3,
} as const;

/**
 * Fiches dont un alias correspond à la requête, avec le meilleur rang : égalité exacte, début
 * de l'alias, début d'un mot de l'alias. (Pas de « contient » : « at » ne doit pas remonter
 * « Chat ».)
 */
export function matchAliases(
  query: string,
  aliases: Readonly<Record<number, readonly string[]>> = SPECIES_ALIASES,
): Map<number, number> {
  const q = foldText(query);
  const found = new Map<number, number>();
  if (q.length < 2) return found;
  for (const [id, names] of Object.entries(aliases)) {
    let best: number | undefined;
    for (const name of names) {
      const n = foldText(name);
      let rank: number | undefined;
      if (n === q) rank = SEARCH_RANK.EXACT;
      else if (n.startsWith(q)) rank = SEARCH_RANK.PREFIX;
      else if (n.split(/[\s'-]+/).some((w) => w.startsWith(q)))
        rank = SEARCH_RANK.WORD_PREFIX;
      if (rank !== undefined && (best === undefined || rank < best)) {
        best = rank;
      }
    }
    if (best !== undefined) found.set(Number(id), best);
  }
  return found;
}
