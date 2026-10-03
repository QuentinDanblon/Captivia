import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../auth.constants';
import { NormalizeEmail } from './normalize-email.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Le mot de passe doit contenir au plus ${PASSWORD_MAX_LENGTH} caractères`,
  })
  password: string;

  @ApiPropertyOptional({ example: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiProperty({
    description:
      "Acceptation des conditions d'utilisation et de la politique de confidentialité (doit valoir true)",
  })
  @Equals(true, {
    message:
      "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
  })
  acceptTerms: boolean;

  @ApiProperty({
    description: "Confirmation d'avoir 15 ans ou plus (doit valoir true)",
  })
  @Equals(true, { message: 'Vous devez confirmer avoir 15 ans ou plus' })
  ageConfirmed: boolean;
}
