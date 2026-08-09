import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsArray,
  IsEnum,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Statuts IUCN Red List (valeurs officielles) */
export enum IucnStatus {
  EX = 'EX',
  EW = 'EW',
  CR = 'CR',
  EN = 'EN',
  VU = 'VU',
  NT = 'NT',
  LC = 'LC',
  DD = 'DD',
  NE = 'NE',
}

export class SearchSpeciesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  kingdom?: string;

  @IsOptional()
  @IsString()
  phylum?: string;

  @IsOptional()
  @IsString()
  class?: string;

  @IsOptional()
  @IsString()
  order?: string;

  @IsOptional()
  @IsString()
  family?: string;

  @IsOptional()
  @IsString()
  genus?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsEnum(IucnStatus)
  iucnStatus?: IucnStatus;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: ('gbif' | 'wikipedia' | 'wikidata')[];
}

export class GetSpeciesDto {
  @IsNotEmpty()
  @IsString()
  // Numérique strict (ID GBIF positif, sans zéros en tête ni '0') :
  // centralise ici la regex qui n'était appliquée que sur une seule route.
  @Matches(/^[1-9]\d*$/, {
    message: 'id must be a positive numeric string',
  })
  id: string;
}

export class GetSpeciesWithSourcesDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: ('gbif' | 'wikipedia' | 'wikidata')[];
}

export class ConservationStatusDto {
  @IsNotEmpty()
  @IsString()
  qid: string;

  @IsOptional()
  @IsEnum(['iucn', 'cites', 'berne', 'cms'])
  statusType?: string;
}

export class GetVernacularNamesDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class GetWikipediaDto {
  @IsNotEmpty()
  @IsString()
  title: string;
}

export class GetWikidataDto {
  @IsNotEmpty()
  @IsString()
  qid: string;
}
