import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    // Code machine facultatif (ex. GUEST_ACCOUNT, EMAIL_NOT_VERIFIED) et action associée :
    // transmis tels quels pour que le client adapte son message (jamais de détail interne).
    let code: string | undefined;
    let action: string | undefined;

    // Erreurs « client » levées avant Nest par l'analyseur de corps (body-parser / http-errors) :
    // corps trop gros (413), JSON invalide (400)… Elles portent un statut 4xx et `expose: true`.
    // Sans ce cas, elles tombaient en 500 « Internal server error ».
    const clientError = clientHttpError(exception);

    if (clientError) {
      status = clientError.status;
      message =
        status === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'Payload too large'
          : clientError.message;
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) code = 'PAYLOAD_TOO_LARGE';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      const body = exception.getResponse();
      if (body && typeof body === 'object') {
        const { code: c, action: a } = body as Record<string, unknown>;
        if (typeof c === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(c)) code = c;
        if (typeof a === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(a))
          action = a;
      }
    }

    // Les erreurs serveur (>= 500) et toute exception non-HTTP sont journalisées avec leur
    // stack : sans cela, un 500 est invisible côté serveur. La stack n'est JAMAIS renvoyée
    // au client (la réponse ci-dessous ne contient que statut, message générique, chemin).
    if (
      status >= HttpStatus.INTERNAL_SERVER_ERROR ||
      (!(exception instanceof HttpException) && !clientError)
    ) {
      // Chemin sans query string (peut contenir des tokens) ni corps de requête.
      const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
      const detail =
        exception instanceof Error ? exception.message : String(exception);
      const reqId = (request as Request & { id?: string }).id;
      this.logger.error(
        `${request.method} ${path} -> ${status}: ${detail}${reqId ? ` (reqId=${reqId})` : ''}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Remontée à Sentry des erreurs serveur (>= 500 ou non-HTTP) si initialisé.
      if (Sentry.isInitialized()) {
        Sentry.captureException(exception, {
          tags: reqId ? { request_id: reqId } : undefined,
        });
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      ...(action ? { action } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

/** Erreur http-errors exposable (4xx) levée par body-parser, sinon null. */
function clientHttpError(
  exception: unknown,
): { status: number; message: string } | null {
  if (exception instanceof HttpException) return null;
  if (!exception || typeof exception !== 'object') return null;
  const { status, statusCode, expose, message } = exception as {
    status?: unknown;
    statusCode?: unknown;
    expose?: unknown;
    message?: unknown;
  };
  const code = typeof status === 'number' ? status : statusCode;
  if (typeof code !== 'number' || code < 400 || code > 499 || expose !== true)
    return null;
  return {
    status: code,
    message: typeof message === 'string' ? message : 'Bad request',
  };
}
