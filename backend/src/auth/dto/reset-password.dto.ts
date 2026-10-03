import { IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../auth.constants';

export class ResetPasswordDto {
  /** Token reçu par email (32 octets aléatoires en hexadécimal). */
  @IsString()
  @MaxLength(256)
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Le mot de passe doit contenir au plus ${PASSWORD_MAX_LENGTH} caractères`,
  })
  newPassword: string;
}
