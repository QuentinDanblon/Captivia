import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { setExternalHttpAdapterOverride } from '../src/external/http/http-adapter-override';
import { createTestApp } from './utils/create-app';
import {
  FakeRoute,
  createFakeExternalAdapter,
  fakeExternalCalls,
} from './utils/fake-external-adapter';

/**
 * API externes (W1-04 / W3-05) : déterminisme (transport simulé, jamais de réseau),
 * validation des entrées, intégrations désactivées, résilience (aucun 500, cache non pollué).
 */
describe('API externes — fixtures, validation, intégrations désactivées', () => {
  let app: INestApplication;
  let url: string;
  const savedToken = process.env.SPECIESPLUS_API_TOKEN;

  beforeAll(async () => {
    delete process.env.SPECIESPLUS_API_TOKEN;
    ({ app, url } = await createTestApp());
  });

  afterAll(async () => {
    if (savedToken !== undefined) process.env.SPECIESPLUS_API_TOKEN = savedToken;
    if (app) await app.close();
  });

  describe('déterminisme (aucun appel réel)', () => {
    it('GET /food/search sert les fixtures Open Pet Food Facts', async () => {
      const res = await request(url).get('/food/search?q=dog+food').expect(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].code).toBe('3017620422003');
      expect(res.body.degraded).toBeUndefined();
    });

    it('GET /species/:id lit la taxonomie GBIF simulée et GET /species/999999 → 404', async () => {
      const ok = await request(url).get('/species/1').expect(200);
      expect(ok.body).toMatchObject({ key: 1, kingdom: 'Animalia', source: 'gbif' });
      await request(url).get('/species/999999').expect(404);
    });

    it('aucune requête ne sort vers un hôte autre que ceux des fixtures', () => {
      expect(fakeExternalCalls.length).toBeGreaterThan(0);
      const hosts = new Set(fakeExternalCalls.map((c) => c.split('/')[0]));
      for (const host of hosts) {
        expect(['api.gbif.org', 'world.openpetfoodfacts.org']).toContain(host);
      }
    });
  });

  describe('validation des entrées (DTO)', () => {
    it.each(['12345', 'abcdefgh', '1234567890123456', '3017620422003x'])(
      'GET /food/product/%s → 400 (barcode ^\\d{8,14}$)',
      async (barcode) => {
        const res = await request(url).get(`/food/product/${barcode}`).expect(400);
        expect(JSON.stringify(res.body)).toContain('barcode must be 8 to 14 digits');
      },
    );

    it('GET /food/product/<barcode valide> → 200 ; inconnu → 404', async () => {
      const res = await request(url).get('/food/product/3017620422003').expect(200);
      expect(res.body.code).toBe('3017620422003');
      await request(url).get('/food/product/99999999').expect(404);
    });

    it('GET /food/search : requête > 100 caractères → 400, sans q → 400', async () => {
      await request(url).get(`/food/search?q=${'a'.repeat(101)}`).expect(400);
      await request(url).get('/food/search').expect(400);
      await request(url).get('/food/search?q=dog&pageSize=101').expect(400);
    });

    it('GET /species/search : q > 100 caractères → 400', async () => {
      await request(url).get(`/species/search?q=${'a'.repeat(101)}`).expect(400);
    });

    it('GET /pubmed/search : q manquant, trop court ou trop long → 400', async () => {
      await request(url).get('/pubmed/search').expect(400);
      await request(url).get('/pubmed/search?q=a').expect(400);
      await request(url).get(`/pubmed/search?q=${'a'.repeat(201)}`).expect(400);
      await request(url).get('/pubmed/search?q=boa&limit=500').expect(400);
    });

    it('GET /pubmed/search?q=boa → 200 (PubMed est publique, sans clé)', async () => {
      const res = await request(url).get('/pubmed/search?q=boa+constrictor').expect(200);
      expect(res.body).toEqual([]);
    });

    it('GET /wikidata/entity : QID invalide → 400 ; /open-data/* : taxonId invalide → 400', async () => {
      await request(url).get('/wikidata/entity?qid=Q1}').expect(400);
      await request(url).get('/api/open-data/eol/taxon?taxonId=abc').expect(400);
      await request(url).get(`/api/open-data/wikipedia?title=${'a'.repeat(201)}`).expect(400);
    });
  });

  describe('intégrations désactivées ou retirées (aucune donnée inventée)', () => {
    it('/amazon/search → 404 (route retirée : pas d’intégration Amazon, D-09)', async () => {
      await request(url).get('/amazon/search?q=terrarium').expect(404);
      await request(url).get('/amazon').expect(404);
    });

    it('/speciesplus/* → 503 INTEGRATION_DISABLED sans SPECIESPLUS_API_TOKEN', async () => {
      for (const path of [
        '/speciesplus/search?name=Boa+constrictor',
        '/speciesplus/taxon/1/cites',
        '/speciesplus/taxon/1/eu',
      ]) {
        const res = await request(url).get(path).expect(503);
        expect(res.body.code).toBe('INTEGRATION_DISABLED');
        expect(res.body.message).toContain('not configured');
      }
    });

    it('/speciesplus/search : nom trop court → 400 (validation avant 503)', async () => {
      await request(url).get('/speciesplus/search?name=a').expect(400);
    });

    it('GET /species/:id/legislation : speciesPlus.status = disabled, aucune donnée CITES inventée', async () => {
      const res = await request(url).get('/species/123/legislation').expect(200);
      expect(res.body.speciesPlus).toEqual({ status: 'disabled', cites: null, eu: null });
    });

    it('GET /equipment : aucune liste de produits Amazon inventée', async () => {
      const res = await request(url).get('/equipment').expect(200);
      for (const rec of res.body.recommendations) {
        expect(rec).not.toHaveProperty('products');
      }
    });
  });

  describe('GET /gateway/health', () => {
    it('Wikipedia n’est plus « unhealthy » à tort ; statut global cohérent', async () => {
      const res = await request(url).get('/gateway/health').expect(200);
      expect(res.body.services.wikipedia.status).toBe('healthy');
      expect(res.body.services.gbif.status).toBe('healthy');
      expect(res.body.services.wikidata.status).toBe('healthy');
      expect(res.body.status).toBe('healthy');
    });
  });
});

describe('API externes — pannes des fournisseurs (aucun 500, cache non pollué)', () => {
  let app: INestApplication;
  let url: string;
  const outage = { opff: false, gbif: false };

  const outageRoute: FakeRoute = (reqUrl) => {
    if (outage.opff && reqUrl.hostname === 'world.openpetfoodfacts.org') {
      return { status: 503 };
    }
    if (outage.gbif && reqUrl.hostname === 'api.gbif.org') {
      return { status: 503 };
    }
    return undefined;
  };

  beforeAll(async () => {
    setExternalHttpAdapterOverride(createFakeExternalAdapter([outageRoute]));
    ({ app, url } = await createTestApp());
  });

  afterAll(async () => {
    setExternalHttpAdapterOverride(createFakeExternalAdapter());
    if (app) await app.close();
  });

  it('Open Pet Food Facts en panne : /food/search → 200 « degraded », puis le résultat réel n’est PAS masqué par un cache vide', async () => {
    outage.opff = true;
    const down = await request(url).get('/food/search?q=dog+food').expect(200);
    expect(down.body).toMatchObject({ products: [], count: 0, degraded: true });

    outage.opff = false;
    const up = await request(url).get('/food/search?q=dog+food').expect(200);
    expect(up.body.products).toHaveLength(1);
    expect(up.body.degraded).toBeUndefined();
  });

  it('Open Pet Food Facts en panne : /food/species/:species → 200 (jamais 500), /food/product → 503 (pas un faux 404)', async () => {
    outage.opff = true;
    const species = await request(url).get('/food/species/boa').expect(200);
    expect(species.body.degraded).toBe(true);

    const product = await request(url).get('/food/product/3017620422003').expect(503);
    expect(product.body.statusCode).toBe(503);
    outage.opff = false;
  });

  it('GBIF en panne : la recherche renvoie 200, le détail local reste servi (repli sur le SpeciesProfile)', async () => {
    outage.gbif = true;

    // Recherche sans résultat local → fallback GBIF en échec : 200, pas de 500
    const search = await request(url).get('/species/search?q=zzfallback').expect(200);
    expect(search.body.results).toEqual([]);
    expect(search.body.degraded).toBe(true);

    // Fiche d'une espèce du seed : 200 depuis le profil local, taxonomie absente
    const detail = await request(url).get('/species/5221172').expect(200);
    expect(detail.body).toMatchObject({ key: 5221172, source: 'profile', degraded: true });
    expect(detail.body.name).toBeTruthy();

    // Espèce absente du seed : on ne ment pas par un 404, c'est un 503 explicite
    await request(url).get('/species/1').expect(503);
  });

  it('GBIF en panne prolongée : le disjoncteur s’ouvre, plus aucun appel réseau, toujours aucun 500', async () => {
    outage.gbif = true;
    // Quelques requêtes supplémentaires pour franchir le seuil d'ouverture (5 échecs consécutifs)
    for (let i = 0; i < 3; i++) {
      await request(url).get(`/species/search?q=zzfallback${i}`).expect(200);
    }
    const before = fakeExternalCalls.length;

    const res = await request(url).get('/species/search?q=zzbreaker').expect(200);
    expect(res.body.degraded).toBe(true);
    const gbifCallsWhileOpen = fakeExternalCalls
      .slice(before)
      .filter((call) => call.startsWith('api.gbif.org'));
    expect(gbifCallsWhileOpen).toHaveLength(0);

    const health = await request(url).get('/gateway/health').expect(200);
    expect(health.body.services.gbif).toMatchObject({ status: 'unhealthy', circuit: 'open' });
    expect(health.body.status).toBe('degraded');
  });
});
