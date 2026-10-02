import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Bornes inclusives `YYYY-MM-DD` ; la validité calendaire et l'amplitude sont contrôlées par le service. */
export class AgendaQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DAY_REGEX, { message: 'from must be a date formatted YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DAY_REGEX, { message: 'to must be a date formatted YYYY-MM-DD' })
  to?: string;
}

export class AgendaFeedQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  token?: string;
}
