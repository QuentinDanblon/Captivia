import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
