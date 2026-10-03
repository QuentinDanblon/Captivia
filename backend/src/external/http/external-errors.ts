import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';

/**
 * Levée quand un appel externe est refusé SANS requête réseau (disjoncteur ouvert).
 * Les appelants la traitent comme une indisponibilité du
 * fournisseur (repli sur les données locales / le cache périmé).
 */
export class ExternalUnavailableError extends Error {
  readonly name = 'ExternalUnavailableError';

  constructor(
    readonly provider: string,
    readonly reason: 'circuit_open' = 'circuit_open',
  ) {
    super(`External provider "${provider}" unavailable (${reason})`);
  }
}

/** L'erreur vient-elle d'un fournisseur tiers (réseau, timeout, HTTP, disjoncteur) ? */
export function isUpstreamError(error: unknown): boolean {
  return error instanceof ExternalUnavailableError || axios.isAxiosError(error);
}

/** Le fournisseur a-t-il répondu 404 ? */
export function isUpstreamNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

/** 503 explicite « fournisseur indisponible » (code machine UPSTREAM_UNAVAILABLE). */
export function upstreamUnavailable(message: string): HttpException {
  return new HttpException(
    { message, code: 'UPSTREAM_UNAVAILABLE' },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

/**
 * Exception HTTP à renvoyer au client : 503 si le fournisseur est en cause (jamais de
 * détail interne), 500 sinon. Les HttpException existantes sont conservées telles quelles.
 */
export function toUpstreamHttpException(
  error: unknown,
  message: string,
): HttpException {
  if (error instanceof HttpException) return error;
  if (isUpstreamError(error)) return upstreamUnavailable(message);
  return new InternalServerErrorException(message);
}
