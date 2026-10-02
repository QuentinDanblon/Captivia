import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Corps de POST /auth/refresh et POST /auth/logout (W1-01). */
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
