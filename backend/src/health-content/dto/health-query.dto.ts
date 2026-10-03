import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class HealthQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  disease?: string;

  /** Code langue à 2 lettres (fr, en…). */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'locale must be a 2-letter language code' })
  locale?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

/** GET /pubmed/search — requête bornée (transmise telle quelle à NCBI). */
export class PubMedSearchDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  q: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number;
}
