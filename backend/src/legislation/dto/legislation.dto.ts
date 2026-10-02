import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class LegislationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;
}

export class CreateLegislationDto {
  @IsString()
  @Length(2, 2)
  country: string;

  @IsIn(['allowed', 'prohibited', 'permit_required'])
  status: string;

  @IsOptional()
  @IsObject()
  details?: any;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sources?: string[];
}
