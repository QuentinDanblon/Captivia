import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DEVICE_TOKEN_MAX_LENGTH,
  DEVICE_TOKEN_REGEX,
} from '../../notifications/dto/device-token.dto';

/** Corps de POST /auth/refresh (W1-01). */
export class RefreshTokenDto {
  @ApiProperty({
    description:
      'Refresh token opaque reçu au login (32 octets en hexadécimal).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  refreshToken: string;
}

/** Corps de POST /auth/logout : refresh token + abonnement push facultatif de cet appareil. */
export class LogoutDto extends RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      "Endpoint Web Push de cet appareil : l'abonnement correspondant du compte est supprimé.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @ApiPropertyOptional({
    description:
      "Jeton de push natif (FCM) de cette installation de l'app : supprimé s'il appartient au compte (W6-07).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_TOKEN_MAX_LENGTH)
  @Matches(DEVICE_TOKEN_REGEX, {
    message: 'deviceToken must be an FCM registration token',
  })
  deviceToken?: string;
}

/** Corps de POST /auth/verify-email (W2-04). */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'Token reçu par e-mail (32 octets en hexadécimal).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  token: string;
}
