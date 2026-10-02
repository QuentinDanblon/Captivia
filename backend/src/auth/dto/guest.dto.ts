import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RegisterDto } from './register.dto';

/** Langues de l'interface (frontend/messages/*.json) acceptées pour un invité. */
export const GUEST_LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt'] as const;

/** Corps de POST /auth/guest : tout est facultatif (aucune donnée personnelle). */
export class CreateGuestDto {
  @ApiPropertyOptional({ example: 'fr', enum: GUEST_LOCALES })
  @IsOptional()
  @IsString()
  @IsIn(GUEST_LOCALES)
  locale?: string;
}

/**
 * Corps de POST /auth/upgrade : mêmes champs et mêmes règles que l'inscription (e-mail normalisé,
 * mot de passe 10-128, CGU et âge obligatoires).
 */
export class UpgradeGuestDto extends RegisterDto {}
