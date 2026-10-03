import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Longueur maximale des termes envoyés aux API tierces (protection contre l'amplification). */
export const EXTERNAL_QUERY_MAX_LENGTH = 200;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** `?q=` — recherche libre (Wikipedia, Wikidata, PubMed…). */
export class ExternalSearchQDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(EXTERNAL_QUERY_MAX_LENGTH)
  q: string;
}

/** `?query=` — recherche libre (iNaturalist, EOL, multi-sources). */
export class ExternalQueryDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(EXTERNAL_QUERY_MAX_LENGTH)
  query: string;
}

/** `?title=` — titre d'article. */
export class ExternalTitleDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(EXTERNAL_QUERY_MAX_LENGTH)
  title: string;
}

/** `?scientificName=` — nom scientifique. */
export class ExternalScientificNameDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  scientificName: string;
}

/** `?taxonId=&limit=` — recherche par identifiant de taxon. */
export class ExternalTaxonQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  taxonId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
