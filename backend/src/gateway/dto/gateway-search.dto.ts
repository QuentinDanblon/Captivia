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

/** Bornes de la recherche gateway (protection contre l'amplification d'appels externes). */
export const GATEWAY_QUERY_MIN_LENGTH = 2;
export const GATEWAY_QUERY_MAX_LENGTH = 100;
export const GATEWAY_LIMIT_MIN = 1;
export const GATEWAY_LIMIT_MAX = 20;
export const GATEWAY_LIMIT_DEFAULT = 10;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class GatewayEnrichedDto {
  @Transform(trim)
  @IsString()
  @MinLength(GATEWAY_QUERY_MIN_LENGTH)
  @MaxLength(GATEWAY_QUERY_MAX_LENGTH)
  query: string;

  @IsOptional()
  @IsString()
  sources?: string;
}

export class GatewaySearchDto extends GatewayEnrichedDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(GATEWAY_LIMIT_MIN)
  @Max(GATEWAY_LIMIT_MAX)
  limit?: number = GATEWAY_LIMIT_DEFAULT;
}
