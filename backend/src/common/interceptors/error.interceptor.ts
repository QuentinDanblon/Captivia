import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import axios, { AxiosError } from 'axios';
import {
  GbifApiException,
  GbifRateLimitException,
  GbifNotFoundException,
  GbifTimeoutException,
  GbifServiceUnavailableException,
} from '../exceptions/custom-exceptions';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        this.logError(error);

        // Gérer les erreurs spécifiques GBIF
        if (axios.isAxiosError(error)) {
          return this.handleAxiosError(error);
        }

        // Propager l'erreur
        return throwError(() => error);
      }),
    );
  }

  private logError(error: any) {
    if (error instanceof GbifApiException) {
      this.logger.warn(`GBIF API Error: ${error.message}`, {
        code: error.gbifCode,
        status: error.getStatus(),
      });
    } else {
      this.logger.error('Unexpected error:', error);
    }
  }

  private handleAxiosError(error: AxiosError): Observable<never> {
    const status = error.response?.status || 500;

    switch (status) {
      case 429:
        throw new GbifRateLimitException();
      case 404:
        throw new GbifNotFoundException();
      case 503:
        throw new GbifServiceUnavailableException();
      case 504:
        throw new GbifTimeoutException();
      default:
        throw new GbifApiException(
          `Erreur GBIF: ${error.message}`,
          status,
          'API_ERROR',
        );
    }
  }
}
