import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { GUEST_LOCALES } from '../../auth/dto/guest.dto';

/** Plateformes du push natif (W6-07). */
export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** Longueur maximale d'un jeton (FCM : ~160 caractères aujourd'hui, marge pour l'évolution). */
export const DEVICE_TOKEN_MAX_LENGTH = 4096;
/**
 * Jeton d'enregistrement FCM : caractères base64url plus « : » (format `<instance>:<jeton>`),
 * au moins 32 caractères. Refuse espaces, contrôles, chemins et URL.
 */
export const DEVICE_TOKEN_REGEX = /^[A-Za-z0-9_:-]{32,4096}$/;

export class RegisterDeviceTokenDto {
  @ApiProperty({
    description: "Jeton d'enregistrement FCM de cette installation de l'app.",
  })
  @IsString()
  @MaxLength(DEVICE_TOKEN_MAX_LENGTH)
  @Matches(DEVICE_TOKEN_REGEX, {
    message: 'token must be an FCM registration token',
  })
  token: string;

  @ApiProperty({ enum: DEVICE_PLATFORMS })
  @IsIn(DEVICE_PLATFORMS)
  platform: DevicePlatform;

  @ApiPropertyOptional({ enum: GUEST_LOCALES, example: 'fr' })
  @IsOptional()
  @IsIn(GUEST_LOCALES)
  locale?: string;

  @ApiPropertyOptional({
    description:
      "Les rappels de soins prévus avant cet instant (ISO 8601) sont déjà programmés en notifications locales sur l'appareil : ils ne lui sont pas renvoyés en push. null : aucun ; absent : valeur précédente conservée.",
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601({ strict: true })
  @MaxLength(40)
  localRemindersUntil?: string | null;

  @ApiPropertyOptional({
    description:
      "Jeton précédent de cette installation (rafraîchi par FCM) : supprimé s'il appartient au compte.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_TOKEN_MAX_LENGTH)
  @Matches(DEVICE_TOKEN_REGEX, {
    message: 'previousToken must be an FCM registration token',
  })
  previousToken?: string;
}

export class UnregisterDeviceTokenDto {
  @ApiProperty({ description: 'Jeton FCM à retirer du compte.' })
  @IsString()
  @MaxLength(DEVICE_TOKEN_MAX_LENGTH)
  @Matches(DEVICE_TOKEN_REGEX, {
    message: 'token must be an FCM registration token',
  })
  token: string;
}
