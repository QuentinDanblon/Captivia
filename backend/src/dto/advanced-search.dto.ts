/**
 * DTOs pour la recherche avancée d'espèces
 * Source: plans/resource-improvement-plan.md
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

export class AdvancedSearchDto {
  @ApiProperty({ required: true, description: 'Recherche textuelle' })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  query: string;

  /** Alias historique de `query`. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiProperty({
    required: false,
    default: 50,
    description: 'Nombre maximum de résultats (1-100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    required: false,
    default: 0,
    description: 'Offset pour la pagination',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** Alias de `limit`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  /** Alias de `offset`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiProperty({ required: false, description: 'Filtre par rang' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  rank?: string;

  @ApiProperty({ required: false, description: 'Filtre par royaume' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  kingdom?: string;

  @ApiProperty({ required: false, description: 'Filtre par phylum' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  phylum?: string;

  @ApiProperty({ required: false, description: 'Filtre par classe' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  class?: string;

  @ApiProperty({ required: false, description: 'Filtre par ordre' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  order?: string;

  @ApiProperty({ required: false, description: 'Filtre par famille' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  family?: string;

  @ApiProperty({ required: false, description: 'Filtre par genre' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  genus?: string;

  @ApiProperty({ required: false, description: 'Filtre par statut IUCN' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  iucnStatus?: string;

  @ApiProperty({
    required: false,
    description: 'Filtre par pays de distribution',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ required: false, description: 'Filtre par langue' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  language?: string;

  @ApiProperty({
    required: false,
    description: "Filtre par nombre minimum d'occurrences",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOccurrences?: number;

  @ApiProperty({
    required: false,
    enum: ['relevance', 'popularity', 'occurrences'],
    description: 'Critère de tri',
  })
  @IsOptional()
  @IsIn(['relevance', 'popularity', 'occurrences'])
  sortBy?: 'relevance' | 'popularity' | 'occurrences';

  @ApiProperty({
    required: false,
    enum: ['asc', 'desc'],
    description: 'Ordre du tri',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class AdvancedSearchResults {
  @ApiProperty({ description: 'Résultats de recherche' })
  results: unknown[];

  @ApiProperty({ description: 'Nombre total de résultats' })
  total: number;

  @ApiProperty({ description: 'Critères de tri appliqués' })
  sortBy?: string;

  @ApiProperty({ description: 'Ordre du tri appliqué' })
  sortOrder?: string;

  @ApiProperty({ description: 'Source des données' })
  source: 'gbif' | 'cache';

  @ApiProperty({ description: 'Score de qualité moyen' })
  avgQualityScore?: number;
}

export class SearchSuggestionsDto {
  @ApiProperty({ required: true, description: 'Recherche partielle' })
  query: string;

  @ApiProperty({
    required: false,
    default: 10,
    description: 'Nombre de suggestions',
  })
  limit?: number;

  @ApiProperty({
    required: false,
    default: 'french',
    description: 'Langue des suggestions',
  })
  language?: string;
}

export class SearchSuggestions {
  @ApiProperty({ description: 'Suggestions' })
  suggestions: string[];

  @ApiProperty({ description: 'Nombre de suggestions' })
  count: number;
}

export class SpeciesFilterDto {
  @ApiProperty({ required: false, description: 'Recherche textuelle' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  query?: string;

  @ApiProperty({ required: false, description: 'Filtre par rang' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  rank?: string;

  @ApiProperty({ required: false, description: 'Filtre par royaume' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  kingdom?: string;

  @ApiProperty({ required: false, description: 'Filtre par phylum' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  phylum?: string;

  @ApiProperty({ required: false, description: 'Filtre par classe' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  class?: string;

  @ApiProperty({ required: false, description: 'Filtre par ordre' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  order?: string;

  @ApiProperty({ required: false, description: 'Filtre par famille' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  family?: string;

  @ApiProperty({ required: false, description: 'Filtre par genre' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  genus?: string;

  @ApiProperty({ required: false, description: 'Filtre par statut IUCN' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  iucnStatus?: string;

  @ApiProperty({
    required: false,
    description: 'Filtre par pays de distribution',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ required: false, description: 'Filtre par langue' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  language?: string;

  @ApiProperty({ required: false, description: 'Filtre par conservation' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  conservation?: string;

  @ApiProperty({ required: false, description: 'Filtre par région' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiProperty({ required: false, description: 'Filtre par taxonomie' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  taxonomic?: string;

  @ApiProperty({
    required: false,
    description: 'Filtre par présence de médias',
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  hasMedia?: boolean;

  @ApiProperty({ required: false, description: "Filtre par présence d'IUCN" })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  hasIucn?: boolean;
}
