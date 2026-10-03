/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks axios/supertest typés any */
import axios from 'axios';
import { Logger } from '@nestjs/common';
import { PubmedService } from './pubmed.service';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

function buildService() {
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  return new PubmedService(cache as never);
}

describe('PubmedService (résilience)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('applique timeout 8 s et maxRedirects 0 (esearch, esummary, efetch)', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { esearchresult: { idlist: ['1'] } } })
      .mockResolvedValueOnce({ data: { result: { '1': { title: 't' } } } })
      .mockResolvedValueOnce({ data: '<AbstractText>abstract</AbstractText>' });
    const service = buildService();

    await service.searchArticles('boa');
    await service.getArticleAbstract('1');

    expect(mockedGet).toHaveBeenCalledTimes(3);
    for (const call of mockedGet.mock.calls) {
      expect(call[1]).toEqual(
        expect.objectContaining({ timeout: 8000, maxRedirects: 0 }),
      );
    }
  });

  it("logge message + statut seulement en cas d'échec", async () => {
    const err = Object.assign(new Error('timeout of 8000ms exceeded'), {
      config: { headers: { Authorization: 'leak' } },
    });
    mockedGet.mockRejectedValue(err);
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    const service = buildService();

    await expect(service.searchArticles('boa')).resolves.toEqual([]);
    await expect(service.getArticleAbstract('1')).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('leak');
    expect(String(errorSpy.mock.calls[0][0])).toContain(
      'timeout of 8000ms exceeded',
    );
  });
});
