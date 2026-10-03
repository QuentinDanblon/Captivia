import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CommunityPostType,
  CommunityReason,
  CommunitySpeciesCategory,
} from '@prisma/client';
import {
  APPEAL_TEXT_MAX_LENGTH,
  APPEAL_TEXT_MIN_LENGTH,
  COMMENT_BODY_MAX_LENGTH,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  HANDLE_MAX_LENGTH,
  MODERATION_STATEMENT_MAX_LENGTH,
  MODERATION_STATEMENT_MIN_LENGTH,
  PHOTO_POST_MAX_MEDIA,
  POST_BODY_MAX_LENGTH,
  REPORT_DETAILS_MAX_LENGTH,
  SUSPENSION_MAX_DAYS,
} from '../community.constants';

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

export class ActivateProfileDto {
  @ApiProperty({
    example: 'gecko_lover',
    description: '3-30 caractères [A-Za-z0-9_.]',
  })
  @IsString()
  @MaxLength(HANDLE_MAX_LENGTH + 2)
  handle: string;

  @ApiProperty({
    description: 'Acceptation des règles de communauté (doit valoir true)',
  })
  @Equals(true, { message: 'You must accept the community rules' })
  acceptRules: boolean;

  @ApiProperty({
    example: '2026-10',
    description: 'Version des règles affichées et acceptées',
  })
  @IsString()
  @MaxLength(32)
  rulesVersion: string;

  @ApiPropertyOptional({
    description:
      "Confirmation d'avoir l'âge minimal (15 ans) : exigée seulement pour un compte créé avant la case d'âge de l'inscription",
  })
  @IsOptional()
  @IsBoolean()
  ageConfirmed?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'gecko_lover' })
  @IsOptional()
  @IsString()
  @MaxLength(HANDLE_MAX_LENGTH + 2)
  handle?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Nouvel avatar (média téléversé) ou null pour le retirer',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  avatarMediaId?: string | null;

  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Accepte une nouvelle version des règles de communauté',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  acceptRulesVersion?: string;
}

// ---------------------------------------------------------------------------
// Fils
// ---------------------------------------------------------------------------

export class FeedQueryDto {
  @ApiPropertyOptional({
    description: 'Curseur opaque renvoyé par la page précédente',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ default: FEED_DEFAULT_LIMIT, maximum: FEED_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit: number = FEED_DEFAULT_LIMIT;

  @ApiPropertyOptional({ enum: CommunitySpeciesCategory })
  @IsOptional()
  @IsEnum(CommunitySpeciesCategory)
  category?: CommunitySpeciesCategory;

  @ApiPropertyOptional({ enum: CommunityPostType })
  @IsOptional()
  @IsEnum(CommunityPostType)
  type?: CommunityPostType;
}

export class CursorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ default: FEED_DEFAULT_LIMIT, maximum: FEED_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit: number = FEED_DEFAULT_LIMIT;
}

// ---------------------------------------------------------------------------
// Publications, commentaires
// ---------------------------------------------------------------------------

export class CreatePostDto {
  @ApiProperty({ enum: CommunityPostType })
  @IsEnum(CommunityPostType)
  type: CommunityPostType;

  @ApiPropertyOptional({ maxLength: POST_BODY_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(POST_BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Images téléversées (PHOTO : 1 à 4 ; QUESTION : 0 ou 1), dans l’ordre',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PHOTO_POST_MAX_MEDIA)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({
    description:
      "Animal à montrer (nom et espèce seulement) — choix explicite de l'auteur",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    enum: CommunitySpeciesCategory,
    description: "Déduite de l'espèce de l'animal lié si absente",
  })
  @IsOptional()
  @IsEnum(CommunitySpeciesCategory)
  speciesCategory?: CommunitySpeciesCategory;
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: COMMENT_BODY_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body: string;

  @ApiPropertyOptional({
    description: 'Réponse à un commentaire racine (un seul niveau)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

// ---------------------------------------------------------------------------
// Signalements, modération, recours
// ---------------------------------------------------------------------------

export class ReportDto {
  @ApiProperty({ enum: CommunityReason })
  @IsEnum(CommunityReason)
  reason: CommunityReason;

  @ApiPropertyOptional({ maxLength: REPORT_DETAILS_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(REPORT_DETAILS_MAX_LENGTH)
  details?: string;
}

/** Décision opérateur : motif (liste fermée) + exposé des motifs notifié à l'auteur. */
export class ModerationDecisionDto {
  @ApiProperty({ enum: CommunityReason })
  @IsEnum(CommunityReason)
  reason: CommunityReason;

  @ApiProperty({
    minLength: MODERATION_STATEMENT_MIN_LENGTH,
    maxLength: MODERATION_STATEMENT_MAX_LENGTH,
    description: "Exposé des motifs envoyé à l'auteur",
  })
  @IsString()
  @MinLength(MODERATION_STATEMENT_MIN_LENGTH)
  @MaxLength(MODERATION_STATEMENT_MAX_LENGTH)
  statement: string;
}

/** Rétablissement, levée de suspension, classement sans suite : explication obligatoire. */
export class ModerationNoteDto {
  @ApiProperty({
    minLength: MODERATION_STATEMENT_MIN_LENGTH,
    maxLength: MODERATION_STATEMENT_MAX_LENGTH,
  })
  @IsString()
  @MinLength(MODERATION_STATEMENT_MIN_LENGTH)
  @MaxLength(MODERATION_STATEMENT_MAX_LENGTH)
  statement: string;
}

export class SuspendDto extends ModerationDecisionDto {
  @ApiProperty({ minimum: 1, maximum: SUSPENSION_MAX_DAYS })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SUSPENSION_MAX_DAYS)
  days: number;
}

export class AppealDto {
  @ApiProperty({
    minLength: APPEAL_TEXT_MIN_LENGTH,
    maxLength: APPEAL_TEXT_MAX_LENGTH,
  })
  @IsString()
  @MinLength(APPEAL_TEXT_MIN_LENGTH)
  @MaxLength(APPEAL_TEXT_MAX_LENGTH)
  text: string;
}

export class ResolveAppealDto extends ModerationNoteDto {
  @ApiProperty({ enum: ['UPHELD', 'REVERSED'] })
  @IsIn(['UPHELD', 'REVERSED'])
  outcome: 'UPHELD' | 'REVERSED';
}

export class ModerationQueueQueryDto {
  @ApiPropertyOptional({ default: FEED_MAX_LIMIT, maximum: FEED_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit: number = FEED_MAX_LIMIT;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
