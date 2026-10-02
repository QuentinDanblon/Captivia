import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import type { Response } from 'express';
import { AnimalsService } from './animals.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@ApiTags('public')
@Controller('public/animal')
@UseGuards(RateLimitGuard)
export class PublicAnimalController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Get(':slug')
  @ApiOperation({
    summary:
      'Get the public profile of an animal by slug (QR scan). No auth. Opt-in by the owner; whitelist of fields only.',
  })
  @ApiParam({ name: 'slug', description: 'Public slug of the animal' })
  async getBySlug(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Posés avant tout (y compris pour les 404) : pas d'indexation, pas de cache
    // (la révocation du lien doit être immédiate).
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    return this.animalsService.getPublicProfile(slug);
  }
}
