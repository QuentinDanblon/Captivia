import { IsEmail, MaxLength } from 'class-validator';
import { EMAIL_MAX_LENGTH } from '../auth.constants';
import { NormalizeEmail } from './normalize-email.decorator';

export class ForgotPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;
}
