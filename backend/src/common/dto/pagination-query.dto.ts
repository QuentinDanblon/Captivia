import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const PAGINATION_DEFAULT_LIMIT = 100;
export const PAGINATION_MAX_LIMIT = 100;

/**
 * Pagination commune des listes (W1-05). Les réponses restent des tableaux :
 * sans paramètre, on retourne les 100 premiers éléments (borne de sécurité).
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_MAX_LIMIT)
  limit: number = PAGINATION_DEFAULT_LIMIT;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

/** Convertit une PaginationQueryDto en options Prisma `take` / `skip`. */
export function toPage(p?: Partial<PaginationQueryDto>): {
  take: number;
  skip: number;
} {
  return {
    take: p?.limit ?? PAGINATION_DEFAULT_LIMIT,
    skip: p?.offset ?? 0,
  };
}
