import { HttpException, HttpStatus } from '@nestjs/common';

export class GbifApiException extends HttpException {
  constructor(
    message: string,
    statusCode: number,
    public readonly gbifCode?: string,
  ) {
    super(message, statusCode);
  }
}

export class GbifRateLimitException extends GbifApiException {
  constructor() {
    super('Trop de requêtes. Veuillez réessayer plus tard.', 429, 'RATE_LIMIT');
  }
}

export class GbifNotFoundException extends GbifApiException {
  constructor(message = 'Ressource non trouvée sur GBIF') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class GbifTimeoutException extends GbifApiException {
  constructor() {
    super("Délai d'attente dépassé pour GBIF", 504, 'TIMEOUT');
  }
}

export class GbifServiceUnavailableException extends GbifApiException {
  constructor() {
    super('Service GBIF indisponible', 503, 'SERVICE_UNAVAILABLE');
  }
}

export class GbifInvalidResponseException extends GbifApiException {
  constructor(message = 'Réponse invalide de GBIF') {
    super(message, 500, 'INVALID_RESPONSE');
  }
}
