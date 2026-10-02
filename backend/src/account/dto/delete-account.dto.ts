import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  /** Mot de passe actuel, re-saisi pour confirmer la suppression irréversible. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
