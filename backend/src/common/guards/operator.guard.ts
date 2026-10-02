import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { isOperator } from '../operators';

/**
 * Garde d'accès réservé aux opérateurs (`User.role === OPERATOR`).
 *
 * À utiliser APRÈS JwtAuthGuard : requiert `req.user.role`, rechargé depuis la
 * base à chaque requête par la stratégie JWT (AuthService.validateUser). Le
 * rôle n'est jamais lu depuis le token ni déduit de l'email. Retourne 403 si
 * l'appelant n'est pas un opérateur ou si son adresse e-mail n'est pas vérifiée (W2-04).
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: { role?: string; emailVerified?: boolean } }
      >();

    if (!isOperator(request.user)) {
      throw new ForbiddenException(
        'Seul un opérateur peut effectuer cette action.',
      );
    }
    // W2-04 : un opérateur doit avoir vérifié son adresse e-mail.
    if (request.user?.emailVerified !== true) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message:
          'Adresse e-mail non vérifiée : le rôle opérateur exige un e-mail vérifié.',
      });
    }

    return true;
  }
}
