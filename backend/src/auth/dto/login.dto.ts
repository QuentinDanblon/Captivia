import { IsEmail, IsString, MaxLength } from 'class-validator';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../auth.constants';
import { NormalizeEmail } from './normalize-email.decorator';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  // Pas de longueur minimale au login : les comptes créés avant le passage à
  // 10 caractères minimum doivent pouvoir se connecter.
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
