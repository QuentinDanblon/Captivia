import { IsEmail, IsOptional } from 'class-validator';

/**
 * Corps de la requête d'activation administrative du premium.
 * L'email est un champ de CONFIRMATION facultatif : s'il est fourni, il doit
 * correspondre au compte ciblé par :userId (protection anti-erreur de frappe).
 */
export class AdminActivatePremiumDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
