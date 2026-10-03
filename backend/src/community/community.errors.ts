import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

/**
 * Exceptions portant un `code` machine (transmis tel quel par HttpExceptionFilter), pour que le
 * frontend affiche un message adapté sans analyser le texte.
 */
function body(status: number, code: string, message: string) {
  return { statusCode: status, code, message };
}

export const forbidden = (code: string, message: string) =>
  new ForbiddenException(body(HttpStatus.FORBIDDEN, code, message));

export const badRequest = (code: string, message: string) =>
  new BadRequestException(body(HttpStatus.BAD_REQUEST, code, message));

export const conflict = (code: string, message: string) =>
  new ConflictException(body(HttpStatus.CONFLICT, code, message));

export const notFound = (message = 'Not found') =>
  new NotFoundException(message);

export const tooMany = (code: string, message: string) =>
  new HttpException(
    body(HttpStatus.TOO_MANY_REQUESTS, code, message),
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const withStatus = (status: HttpStatus, code: string, message: string) =>
  new HttpException(body(status, code, message), status);
