import { AxiosError, AxiosHeaders } from 'axios';
import {
  EXTERNAL_REQUEST_DEFAULTS,
  describeHttpError,
  isValidBarcode,
  isValidQid,
} from './http-safety';

describe('http-safety', () => {
  it('impose un timeout de 8 s et aucune redirection', () => {
    expect(EXTERNAL_REQUEST_DEFAULTS.timeout).toBe(8000);
    expect(EXTERNAL_REQUEST_DEFAULTS.maxRedirects).toBe(0);
  });

  describe('describeHttpError', () => {
    it('ne contient ni header ni token pour une AxiosError', () => {
      const headers = new AxiosHeaders({ 'X-Authentication-Token': 'super-secret-token' });
      const error = new AxiosError(
        'Request failed with status code 401',
        'ERR_BAD_REQUEST',
        { headers } as never,
        {},
        { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config: { headers } as never },
      );
      const description = describeHttpError(error);
      expect(description).toBe('Request failed with status code 401 (HTTP 401)');
      expect(description).not.toContain('super-secret-token');
    });

    it('gère une erreur sans statut, une chaîne et une valeur inconnue', () => {
      expect(describeHttpError(new Error('timeout of 8000ms exceeded'))).toBe('timeout of 8000ms exceeded');
      expect(describeHttpError('boom')).toBe('boom');
      expect(describeHttpError(undefined)).toBe('unknown error');
    });
  });

  describe('isValidBarcode', () => {
    it.each(['12345678', '3017620422003', '12345678901234'])('accepte %s', (v) => {
      expect(isValidBarcode(v)).toBe(true);
    });
    it.each(['1234567', '123456789012345', '12345abc', '../etc', '1234 5678', '', undefined])('refuse %p', (v) => {
      expect(isValidBarcode(v)).toBe(false);
    });
  });

  describe('isValidQid', () => {
    it.each(['Q1', 'Q140', 'Q123456789'])('accepte %s', (v) => {
      expect(isValidQid(v)).toBe(true);
    });
    it.each(['q140', 'Q', 'Q12a', 'P31', '140', 'Q1} UNION {', '', undefined])('refuse %p', (v) => {
      expect(isValidQid(v)).toBe(false);
    });
  });
});
