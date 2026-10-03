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
import { Type } from 'class-transformer';
import { BARCODE_REGEX } from '../../external/http-safety';

/** Longueur maximale des termes de recherche transmis à Open Pet Food Facts. */
export const FOOD_QUERY_MAX_LENGTH = 100;

export class FoodSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(FOOD_QUERY_MAX_LENGTH)
  q: string;

  @IsOptional()
  @IsString()
  @MaxLength(FOOD_QUERY_MAX_LENGTH)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FOOD_QUERY_MAX_LENGTH)
  species?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;
}

/** Paramètre de route `:barcode` — interpolé dans l'URL du fournisseur : 8 à 14 chiffres. */
export class BarcodeParamDto {
  @IsString()
  @Matches(BARCODE_REGEX, { message: 'barcode must be 8 to 14 digits' })
  barcode: string;
}

/** Paramètre de route `:species` de /food/species/:species. */
export class FoodSpeciesParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(FOOD_QUERY_MAX_LENGTH)
  species: string;
}

export class FoodSpeciesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;
}
