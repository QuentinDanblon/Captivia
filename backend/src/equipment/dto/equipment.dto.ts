import {
  IsOptional,
  IsString,
  IsInt,
  IsArray,
  Min,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EquipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  speciesId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;
}

export class CreateEquipmentDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  speciesId?: number;

  @IsString()
  @MaxLength(100)
  category: string;

  @IsString()
  @MaxLength(200)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  searchTerms: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  searchTerms?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;
}
