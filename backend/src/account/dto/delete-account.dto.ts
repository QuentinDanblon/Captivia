import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  /**
   * Mot de passe actuel, re-saisi pour confirmer la suppression irréversible.
   * Facultatif uniquement pour un compte invité (qui n'a pas de mot de passe) ;
   * exigé (401 sinon) pour tout autre compte.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password?: string;
}
