/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- tests : mocks du client HTTP typés any */
import { HttpException, Logger } from '@nestjs/common';
import { PubmedService } from './pubmed.service';
import { ExternalUnavailableError } from '../../external/http/external-errors';

function buildService(stale: unknown = null) {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    getStale: jest.fn().mockReturnValue(stale),
    set: jest.fn(),
  };
  const http = { get: jest.fn() };
  return {
    service: new PubmedService(cache as never, http as never),
    cache,
    http,
  };
}

describe('PubmedService (résilience)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.NCBI_API_KEY;
    delete process.env.NCBI_EMAIL;
  });

  it('esearch → esummary → efetch passent par le client partagé (fournisseur « pubmed »)', async () => {
    const { service, http } = buildService();
    http.get
      .mockResolvedValueOnce({ data: { esearchresult: { idlist: ['1'] } } })
      .mockResolvedValueOnce({ data: { result: { '1': { title: 't' } } } })
      .mockResolvedValueOnce({ data: '<AbstractText>abstract</AbstractText>' });

    const articles = await service.searchArticles('boa');
    await service.getArticleAbstract('1');

    expect(articles).toEqual([
      expect.objectContaining({
        pmid: '1',
        title: 't',
        url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
      }),
    ]);
    expect(http.get).toHaveBeenCalledTimes(3);
    for (const call of http.get.mock.calls) {
      expect(call[0]).toBe('pubmed');
    }
  });

  it('sans clé : aucun api_key envoyé (quota public) ; avec clé : api_key et email transmis', async () => {
    const { service, http } = buildService();
    http.get.mockResolvedValue({ data: { esearchresult: { idlist: [] } } });

    await service.searchArticles('sans-cle');
    expect(http.get.mock.calls[0][2].params).toEqual(
      expect.objectContaining({ tool: 'captivia' }),
    );
    expect(http.get.mock.calls[0][2].params).not.toHaveProperty('api_key');

    process.env.NCBI_API_KEY = 'cle-ncbi';
    process.env.NCBI_EMAIL = 'contact@example.test';
    await service.searchArticles('avec-cle');
    expect(http.get.mock.calls[1][2].params).toEqual(
      expect.objectContaining({
        api_key: 'cle-ncbi',
        email: 'contact@example.test',
      }),
    );
  });

  it("n'accepte que des PMID numériques (pas d'injection dans esummary)", async () => {
    const { service, http } = buildService();
    http.get
      .mockResolvedValueOnce({
        data: { esearchresult: { idlist: ['123', '../x', '4,5', 'abc'] } },
      })
      .mockResolvedValueOnce({ data: { result: {} } });

    await service.searchArticles('boa');

    expect(http.get.mock.calls[1][2].params.id).toBe('123');
  });

  it('panne : 503 explicite et AUCUNE écriture en cache (pas de liste vide empoisonnée)', async () => {
    const { service, http, cache } = buildService();
    http.get.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

    const error = await service.searchArticles('boa').catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(503);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('disjoncteur ouvert : repli sur la dernière recherche connue (cache périmé)', async () => {
    const { service, http, cache } = buildService(
      JSON.stringify([{ pmid: '9', title: 'ancien' }]),
    );
    http.get.mockRejectedValue(new ExternalUnavailableError('pubmed'));

    await expect(service.searchArticles('boa')).resolves.toEqual([
      { pmid: '9', title: 'ancien' },
    ]);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('« aucun article » valide : mis en cache brièvement (1 h)', async () => {
    const { service, http, cache } = buildService();
    http.get.mockResolvedValue({ data: { esearchresult: { idlist: [] } } });

    await expect(service.searchArticles('rien')).resolves.toEqual([]);
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), '[]', 3600);
  });

  it("logge message + statut seulement en cas d'échec", async () => {
    const err = Object.assign(new Error('timeout of 5000ms exceeded'), {
      config: { headers: { Authorization: 'leak' } },
    });
    const { service, http } = buildService();
    http.get.mockRejectedValue(err);
    const errorSpy = jest.spyOn(Logger.prototype, 'error');

    await service.searchArticles('boa').catch(() => undefined);
    await expect(service.getArticleAbstract('1')).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('leak');
    expect(String(errorSpy.mock.calls[0][0])).toContain(
      'timeout of 5000ms exceeded',
    );
  });
});
