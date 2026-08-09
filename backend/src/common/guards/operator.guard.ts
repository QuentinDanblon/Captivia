import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { isOperatorEmail } from '../operators';

/**
 * Garde d'accès réservé aux opérateurs (emails listés dans OPERATOR_EMAILS).
 *
 * À utiliser APRÈS JwtAuthGuard : requiert `req.user.email`, renseigné par la
 * stratégie JWT (AuthService.validateUser). Retourne 403 si l'appelant n'est
 * pas un opérateur.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { email?: string } }>();
    const email = request.user?.email;

    if (!isOperatorEmail(email)) {
      throw new ForbiddenException(
        "Seul un opérateur peut effectuer cette action.",
      );
    }

    return true;
  }
}
