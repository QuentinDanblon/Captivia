/**
 * Garde-fous communs aux appels sortants vers des API tierces : validation des
 * identifiants interpolés dans des URLs / requêtes, et description sûre des erreurs.
 * Le client HTTP lui-même (timeout, redirections, taille, retry, disjoncteur) est dans
 * `./http/external-http.service.ts`.
 */

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
    const message =
      typeof err.message === 'string' ? err.message : 'unknown error';
    const status = err.response?.status ?? err.status;
    return typeof status === 'number' ? `${message} (HTTP ${status})` : message;
  }
  return typeof error === 'string' ? error : 'unknown error';
}
