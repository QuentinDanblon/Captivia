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
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CommunityEnabledGuard } from '../community-enabled.guard';
import {
  CommunityErrorCode,
  MEDIA_UPLOAD_HARD_LIMIT_BYTES,
} from '../community.constants';
import { badRequest } from '../community.errors';
import { CommunityMediaService } from './community-media.service';
import { isValidMediaKey } from './media-storage';

type AuthedRequest = { user: { id: string } };

/**
 * Médias communautaires.
 * - `POST /community/media` : téléversement multipart (champ `file`), réservé aux auteurs ;
 *   renvoie `{ id, url, width, height }` à passer ensuite dans `mediaIds` d'une publication
 *   ou `avatarMediaId` du profil.
 * - `GET /community/media/:key` : lecture publique d'une image (pilote `local` seulement ; avec le
 *   pilote `s3`, les URL pointent directement vers le bucket public).
 */
@ApiTags('community')
@Controller('community/media')
@UseGuards(CommunityEnabledGuard)
export class CommunityMediaController {
  constructor(private readonly media: CommunityMediaService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
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
  // Mémoire bornée : plafond dur du flux ; la taille applicative (MEDIA_MAX_BYTES) est contrôlée
  // ensuite, APRÈS le type réel (ordre : signature, taille, traitement).
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MEDIA_UPLOAD_HARD_LIMIT_BYTES,
        files: 1,
        fields: 5,
        parts: 6,
      },
    }),
  )
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
  @ApiOperation({ summary: 'Public image (local storage driver only)' })
  async serve(@Param('key') key: string, @Res() res: Response): Promise<void> {
    if (this.media.driver !== 'local' || !isValidMediaKey(key)) {
      throw new NotFoundException();
    }
    const data = await this.media.read(key);
    if (!data) throw new NotFoundException();
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // helmet impose « same-origin » : le site (autre origine) doit pouvoir afficher l'image.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  }
}
