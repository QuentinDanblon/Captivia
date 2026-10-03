import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CommunityEnabledGuard } from '../community-enabled.guard';
import { CommunityErrorCode } from '../community.constants';
import { badRequest } from '../community.errors';
import { CommunityMediaService, MediaViewer } from './community-media.service';
import {
  CommunityPublisherGuard,
  CommunityUploadInterceptor,
  OptionalJwtAuthGuard,
} from './community-upload.guards';
import { isValidMediaKey } from './media-storage';

type AuthedRequest = { user: { id: string } };

/** Durée de cache d'une image publique (s) : 24 h au plus (un masquage s'applique en ≤ 24 h). */
export const MEDIA_PUBLIC_CACHE_SECONDS = 86_400;

/**
 * Médias communautaires.
 * - `POST /community/media` : téléversement multipart (champ `file`), réservé aux auteurs
 *   (403 avant toute lecture du corps sinon) ; renvoie `{ id, url, width, height }` à passer
 *   ensuite dans `mediaIds` d'une publication ou `avatarMediaId` du profil.
 * - `GET /community/media/:key` : lecture d'une image (pilote `local` seulement ; avec le pilote
 *   `s3`, les URL pointent directement vers le bucket public). L'image d'une publication masquée
 *   répond 404, sauf à son auteur ou à un opérateur authentifiés (en-tête Authorization).
 */
@ApiTags('community')
@Controller('community/media')
@UseGuards(CommunityEnabledGuard)
export class CommunityMediaController {
  constructor(private readonly media: CommunityMediaService) {}

  @Post()
  // Ordre : authentification, puis droit de publier, puis SEULEMENT lecture du corps (multer).
  @UseGuards(JwtAuthGuard, CommunityPublisherGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary:
      'Upload an image (JPEG/PNG/WebP, checked by signature; resized to 1600 px, WebP, metadata stripped)',
  })
  // Mémoire bornée : multer s'arrête au-delà de MEDIA_MAX_BYTES (413 MEDIA_TOO_LARGE).
  @UseInterceptors(CommunityUploadInterceptor)
  upload(
    @Request() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer) {
      throw badRequest(
        CommunityErrorCode.INVALID_MEDIA,
        'Send the image in a multipart field named "file".',
      );
    }
    return this.media.upload(req.user.id, file);
  }

  @Get(':key')
  // Une page du fil charge jusqu'à 80 images : pas de limitation globale par IP sur cette route.
  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Public image (local storage driver only)' })
  async serve(
    @Param('key') key: string,
    @Request() req: { user?: MediaViewer },
    @Res() res: Response,
  ): Promise<void> {
    if (this.media.driver !== 'local' || !isValidMediaKey(key)) {
      throw new NotFoundException();
    }
    const found = await this.media.readFor(key, req.user);
    if (!found) throw new NotFoundException();
    const { data, isPublic } = found;
    res.setHeader('Content-Type', 'image/webp');
    // Image publique : cache 24 h au plus (un masquage ou une suppression s'applique en 24 h aux
    // caches intermédiaires). Image d'un contenu masqué (auteur, opérateur) : jamais en cache.
    res.setHeader(
      'Cache-Control',
      isPublic
        ? `public, max-age=${MEDIA_PUBLIC_CACHE_SECONDS}`
        : 'private, no-store',
    );
    res.setHeader('Vary', 'Authorization');
    // helmet impose « same-origin » : le site (autre origine) doit pouvoir afficher l'image.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  }
}
