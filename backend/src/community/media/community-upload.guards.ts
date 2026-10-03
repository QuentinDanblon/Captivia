import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import multer = require('multer');
import { CommunityAccessService } from '../community-access.service';
import { mediaMaxBytes } from '../community.config';
import { CommunityErrorCode } from '../community.constants';
import { badRequest, withStatus } from '../community.errors';

/**
 * Garde « auteur » du téléversement (membre vérifié, profil actif, règles acceptées, non
 * suspendu). Placé APRÈS JwtAuthGuard et AVANT l'intercepteur multipart : un invité, un compte
 * non vérifié ou suspendu reçoit 403 sans que le corps de la requête soit lu ni mis en mémoire.
 */
@Injectable()
export class CommunityPublisherGuard implements CanActivate {
  constructor(private readonly access: CommunityAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string } }>();
    if (!req.user?.id) throw new UnauthorizedException();
    await this.access.requirePublisher(req.user.id);
    return true;
  }
}

/**
 * Lecture multipart (champ `file`, stockage mémoire) avec un plafond aligné sur
 * `mediaMaxBytes()` (MEDIA_MAX_BYTES), lu à chaque requête : multer interrompt la lecture dès que
 * le plafond est dépassé (413 MEDIA_TOO_LARGE) ; le fichier n'est jamais plus gros en mémoire.
 */
@Injectable()
export class CommunityUploadInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const maxBytes = mediaMaxBytes();
    const single = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxBytes, files: 1, fields: 5, parts: 6 },
    }).single('file');
    await new Promise<void>((resolve, reject) => {
      single(req, res, (error: unknown) => {
        if (error) reject(uploadError(error, maxBytes));
        else resolve();
      });
    });
    return next.handle();
  }
}

function uploadError(error: unknown, maxBytes: number) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return withStatus(
      HttpStatus.PAYLOAD_TOO_LARGE,
      CommunityErrorCode.MEDIA_TOO_LARGE,
      `Image too large (max ${maxBytes} bytes).`,
    );
  }
  return badRequest(
    CommunityErrorCode.INVALID_MEDIA,
    'Send one image in a multipart field named "file".',
  );
}

/**
 * Authentification facultative (lecture des images) : sans en-tête Authorization, aucune lecture
 * en base ; un jeton invalide vaut un visiteur anonyme. `req.user` n'est renseigné que pour un
 * jeton valide (auteur ou opérateur pouvant voir l'image d'un contenu masqué).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.headers.authorization) return true;
    try {
      await super.canActivate(context);
    } catch {
      // Jeton absent, expiré ou invalide : visiteur anonyme.
    }
    return true;
  }

  handleRequest<TUser>(_error: unknown, user: TUser): TUser {
    return (user || undefined) as TUser;
  }
}
