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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    // Les erreurs serveur (>= 500) et toute exception non-HTTP sont journalisées avec leur
    // stack : sans cela, un 500 est invisible côté serveur. La stack n'est JAMAIS renvoyée
    // au client (la réponse ci-dessous ne contient que statut, message générique, chemin).
    if (
      status >= HttpStatus.INTERNAL_SERVER_ERROR ||
      !(exception instanceof HttpException)
    ) {
      // Chemin sans query string (peut contenir des tokens) ni corps de requête.
      const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
      const detail =
        exception instanceof Error ? exception.message : String(exception);
      const reqId = (request as Request & { id?: unknown }).id;
      this.logger.error(
        `${request.method} ${path} -> ${status}: ${detail}${reqId ? ` (reqId=${String(reqId)})` : ''}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Remontée à Sentry des erreurs serveur (>= 500 ou non-HTTP) si initialisé.
      if (Sentry.isInitialized()) {
        Sentry.captureException(exception, {
          tags: reqId ? { request_id: String(reqId) } : undefined,
        });
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
