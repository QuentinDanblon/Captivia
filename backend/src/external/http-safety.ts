import { AxiosRequestConfig } from 'axios';

/**
 * Garde-fous communs aux appels sortants vers des API tierces.
 */

/** Délai maximum d'un appel externe (ms). */
export const EXTERNAL_TIMEOUT_MS = 8000;

/** Taille maximale d'une réponse externe (octets). */
export const EXTERNAL_MAX_CONTENT_LENGTH = 5 * 1024 * 1024;

/**
 * Options axios à fusionner dans chaque appel externe :
 * timeout borné, aucune redirection suivie (évite SSRF par redirection et la
 * retransmission de headers sensibles), taille de réponse bornée.
 */
export const EXTERNAL_REQUEST_DEFAULTS: Pick<
  AxiosRequestConfig,
  'timeout' | 'maxRedirects' | 'maxContentLength'
> = {
  timeout: EXTERNAL_TIMEOUT_MS,
  maxRedirects: 0,
  maxContentLength: EXTERNAL_MAX_CONTENT_LENGTH,
};

/** Code-barres produit (EAN-8 à GTIN-14). */
export const BARCODE_REGEX = /^\d{8,14}$/;

/** Identifiant d'entité Wikidata (ex. Q140). */
export const QID_REGEX = /^Q\d+$/;

export function isValidBarcode(value: unknown): value is string {
  return typeof value === 'string' && BARCODE_REGEX.test(value);
}

export function isValidQid(value: unknown): value is string {
  return typeof value === 'string' && QID_REGEX.test(value);
}

/**
 * Description sûre d'une erreur d'appel externe : message + statut HTTP uniquement.
 * Ne JAMAIS logger l'objet AxiosError : il embarque `config.headers` (donc le header
 * `X-Authentication-Token` de Species+, les clés d'API, etc.) et la requête complète.
 */
export function describeHttpError(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as {
      message?: unknown;
      response?: { status?: unknown };
      status?: unknown;
    };
    const message = typeof err.message === 'string' ? err.message : 'unknown error';
    const status = err.response?.status ?? err.status;
    return typeof status === 'number' ? `${message} (HTTP ${status})` : message;
  }
  return typeof error === 'string' ? error : 'unknown error';
}
