import { IsBoolean, IsOptional } from 'class-validator';

/** Corps de PATCH /users/me/animals/:id/public-link (opt-in du partage public). */
export class UpdatePublicLinkDto {
  /** Active (true) ou révoque (false) la page publique / le QR. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Affiche (true) ou masque (false) les vaccinations (nom + date) sur la page publique. */
  @IsOptional()
  @IsBoolean()
  showHealth?: boolean;
}
