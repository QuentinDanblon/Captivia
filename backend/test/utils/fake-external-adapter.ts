import {
  AxiosAdapter,
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

/**
 * Transport HTTP HORS-LIGNE des tests : remplace le réseau sous le client externe partagé
 * (`ExternalHttpService`). Les suites ne contactent plus jamais GBIF, Open Pet Food Facts,
 * PubMed… (déterminisme, aucun timeout réseau) tout en exerçant le vrai code applicatif :
 * retry, disjoncteur, validation, transformations.
 *
 * - Les fixtures ci-dessous reprennent la FORME des réponses réelles (données de test,
 *   jamais servies par l'application).
 * - Une URL sans fixture échoue en erreur réseau (`ERR_NETWORK`) : on teste ainsi aussi
 *   le chemin « fournisseur indisponible », et rien ne sort jamais vers Internet.
 */

export interface FakeResult {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

export type FakeRoute = (
  url: URL,
  params: Record<string, string | number | undefined>,
) => FakeResult | undefined;

/** Taxons GBIF connus des fixtures (clé → fiche) ; toute autre clé → 404. */
export const GBIF_TAXA: Record<string, Record<string, unknown>> = {
  '1': {
    key: 1,
    scientificName: 'Animalia',
    canonicalName: 'Animalia',
    rank: 'KINGDOM',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Animalia',
  },
  '5221172': {
    key: 5221172,
    scientificName: 'Eublepharis macularius (Blyth, 1854)',
    canonicalName: 'Eublepharis macularius',
    rank: 'SPECIES',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Reptilia',
    order: 'Squamata',
    family: 'Eublepharidae',
    genus: 'Eublepharis',
  },
  '2448340': {
    key: 2448340,
    scientificName: 'Boa constrictor Linnaeus, 1758',
    canonicalName: 'Boa constrictor',
    rank: 'SPECIES',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Reptilia',
    order: 'Squamata',
    family: 'Boidae',
    genus: 'Boa',
  },
  // M11 — clé locale historique de « Chat domestique » : une mousse dans GBIF.
  '5281802': {
    key: 5281802,
    scientificName: 'Grimmia arcuatifolia Kindb.',
    canonicalName: 'Grimmia arcuatifolia',
    rank: 'SPECIES',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Plantae',
    phylum: 'Bryophyta',
    class: 'Bryopsida',
    order: 'Grimmiales',
    family: 'Grimmiaceae',
    genus: 'Grimmia',
  },
  // Audit 5 — espèce animale absente du catalogue (choisie dans le repli GBIF).
  '9001001': {
    key: 9001001,
    scientificName: 'Fixturosaurus exemplaris Test, 2026',
    canonicalName: 'Fixturosaurus exemplaris',
    rank: 'SPECIES',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Squamata',
    order: 'Squamata',
    family: 'Fixturidae',
    genus: 'Fixturosaurus',
  },
  // Plante (repli GBIF « instrument ») et mollusque (groupe non classé par le catalogue).
  '165689944': {
    key: 165689944,
    scientificName: 'Lagenaria siceraria (Molina) Standl.',
    canonicalName: 'Lagenaria siceraria',
    rank: 'SPECIES',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    class: 'Magnoliopsida',
    order: 'Cucurbitales',
    family: 'Cucurbitaceae',
    genus: 'Lagenaria',
  },
  '2291582': {
    key: 2291582,
    scientificName: 'Lissachatina fulica (Bowdich, 1822)',
    canonicalName: 'Lissachatina fulica',
    rank: 'SPECIES',
    taxonomicStatus: 'ACCEPTED',
    kingdom: 'Animalia',
    phylum: 'Mollusca',
    class: 'Gastropoda',
    order: 'Stylommatophora',
    family: 'Achatinidae',
    genus: 'Lissachatina',
  },
};

/** Noms vernaculaires des fixtures (clé → noms) ; toute autre clé connue → liste vide. */
const GBIF_VERNACULAR: Record<
  string,
  Array<{ name: string; language: string }>
> = {
  '9001001': [
    { name: 'test lizard', language: 'eng' },
    { name: 'lézard de démonstration', language: 'fra' },
  ],
};

/** `/species/match` : nom scientifique (minuscules) → rapprochement dans la taxonomie. */
const GBIF_MATCHES: Record<string, Record<string, unknown>> = {
  'felis catus': {
    usageKey: 2435035,
    scientificName: 'Felis catus Linnaeus, 1758',
    canonicalName: 'Felis catus',
    rank: 'SPECIES',
    status: 'ACCEPTED',
    matchType: 'EXACT',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Mammalia',
    order: 'Carnivora',
    family: 'Felidae',
    genus: 'Felis',
  },
  'eublepharis macularius': {
    usageKey: 5221172,
    canonicalName: 'Eublepharis macularius',
    rank: 'SPECIES',
    status: 'ACCEPTED',
    matchType: 'EXACT',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Reptilia',
    order: 'Squamata',
    family: 'Eublepharidae',
    genus: 'Eublepharis',
  },
};

const OPFF_PRODUCT = {
  code: '3017620422003',
  product_name: 'Croquettes test (fixture)',
  brands: 'Marque test',
  categories: 'Dog food',
  quantity: '1 kg',
};

const GBIF_SEARCH_RESULTS = Object.values(GBIF_TAXA).filter(
  (t) => t.rank === 'SPECIES',
);

const routes: FakeRoute[] = [
  // --- GBIF -----------------------------------------------------------------
  (url, params) => {
    if (url.hostname !== 'api.gbif.org') return undefined;
    const path = url.pathname.replace(/^\/v1/, '');

    if (path === '/species/search') {
      const q = String(params.q ?? '').toLowerCase();
      const results = GBIF_SEARCH_RESULTS.filter(
        (t) =>
          String(t.canonicalName).toLowerCase().includes(q) ||
          (q.includes('boa') && t.genus === 'Boa') ||
          (q.includes('gecko') && t.genus === 'Eublepharis'),
      );
      return {
        status: 200,
        data: {
          offset: 0,
          limit: Number(params.limit ?? 20),
          endOfRecords: true,
          count: results.length,
          results,
        },
      };
    }

    if (path === '/species/match') {
      const name = String(params.name ?? '')
        .trim()
        .toLowerCase();
      return {
        status: 200,
        data: GBIF_MATCHES[name] ?? { matchType: 'NONE', confidence: 100 },
      };
    }

    if (path === '/occurrence/search') {
      return {
        status: 200,
        data: {
          offset: 0,
          limit: 1,
          endOfRecords: true,
          count: 42,
          results: [],
        },
      };
    }

    const match = /^\/species\/(\d+)(?:\/(\w+))?$/.exec(path);
    if (!match) return { status: 404, data: {} };
    const [, key, sub] = match;
    if (!GBIF_TAXA[key]) return { status: 404, data: {} };
    if (!sub) return { status: 200, data: GBIF_TAXA[key] };
    if (sub === 'vernacularNames') {
      return {
        status: 200,
        data: { results: GBIF_VERNACULAR[key] ?? [], endOfRecords: true },
      };
    }
    if (['distributions', 'media'].includes(sub)) {
      return { status: 200, data: { results: [], endOfRecords: true } };
    }
    return { status: 200, data: {} }; // iucn, metrics
  },

  // --- Open Pet Food Facts ---------------------------------------------------
  (url, params) => {
    if (url.hostname !== 'world.openpetfoodfacts.org') return undefined;
    if (url.pathname === '/cgi/search.pl') {
      const terms = String(params.search_terms ?? '').toLowerCase();
      const products = terms.includes('dog') ? [OPFF_PRODUCT] : [];
      return {
        status: 200,
        data: { products, count: products.length, page: 1 },
      };
    }
    if (url.pathname === '/categories.json') {
      return { status: 200, data: { tags: [{ name: 'Dog food' }] } };
    }
    const product = /^\/api\/v2\/product\/(\d+)$/.exec(url.pathname);
    if (product) {
      return product[1] === OPFF_PRODUCT.code
        ? { status: 200, data: { status: 1, product: OPFF_PRODUCT } }
        : {
            status: 404,
            data: { status: 0, status_verbose: 'product not found' },
          };
    }
    return { status: 404, data: {} };
  },

  // --- Wikipedia / Wikidata (sondes de santé de /gateway/health) ---------------
  (url) => {
    if (url.hostname.endsWith('wikipedia.org')) {
      return url.pathname === '/api/rest_v1/page/summary/Panthera_leo'
        ? { status: 200, data: { title: 'Panthera leo', extract: 'Fixture.' } }
        : { status: 404, data: {} };
    }
    if (url.hostname === 'query.wikidata.org') {
      return { status: 200, data: { results: { bindings: [] } } };
    }
    if (url.hostname === 'www.wikidata.org') {
      return { status: 200, data: { search: [], entities: {} } };
    }
    return undefined;
  },

  // --- PubMed (E-utilities) ---------------------------------------------------
  (url) => {
    if (url.hostname !== 'eutils.ncbi.nlm.nih.gov') return undefined;
    if (url.pathname.endsWith('/esearch.fcgi')) {
      return {
        status: 200,
        data: { esearchresult: { count: '0', idlist: [] } },
      };
    }
    if (url.pathname.endsWith('/esummary.fcgi')) {
      return { status: 200, data: { result: { uids: [] } } };
    }
    return { status: 200, data: '' };
  },
];

function toResponse(
  config: InternalAxiosRequestConfig,
  result: FakeResult,
): AxiosResponse {
  return {
    status: result.status,
    statusText: String(result.status),
    data: result.data ?? {},
    headers: new AxiosHeaders(result.headers ?? {}),
    config,
    request: {},
  };
}

/** URLs demandées depuis le début du fichier de test (assertions « aucun appel réseau »). */
export const fakeExternalCalls: string[] = [];

/**
 * Crée l'adaptateur. `extraRoutes` (prioritaires) permet à une suite de simuler une
 * panne ou une réponse précise d'un fournisseur.
 */
export function createFakeExternalAdapter(
  extraRoutes: FakeRoute[] = [],
): AxiosAdapter {
  // Adaptateur synchrone sous le capot : `new Promise` convertit les `throw` en rejets.
  const handle = (config: InternalAxiosRequestConfig) => {
    const url = new URL(String(config.url), config.baseURL);
    const params = (config.params ?? {}) as Record<
      string,
      string | number | undefined
    >;
    fakeExternalCalls.push(`${url.hostname}${url.pathname}`);

    for (const route of [...extraRoutes, ...routes]) {
      const result = route(url, params);
      if (!result) continue;
      const response = toResponse(config, result);
      const valid = config.validateStatus
        ? config.validateStatus(result.status)
        : result.status >= 200 && result.status < 300;
      if (valid) return response;
      throw new AxiosError(
        `Request failed with status code ${result.status}`,
        result.status >= 500
          ? AxiosError.ERR_BAD_RESPONSE
          : AxiosError.ERR_BAD_REQUEST,
        config,
        {},
        response,
      );
    }

    throw new AxiosError(
      `External HTTP blocked in tests (no fixture): ${url.hostname}${url.pathname}`,
      AxiosError.ERR_NETWORK,
      config,
    );
  };
  return (config) => new Promise((resolve) => resolve(handle(config)));
}
