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
 * l'appelant n'est pas un opérateur.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { role?: string } }>();

    if (!isOperator(request.user)) {
      throw new ForbiddenException(
        'Seul un opérateur peut effectuer cette action.',
      );
    }

    return true;
  }
}
