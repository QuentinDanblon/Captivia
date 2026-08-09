import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

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
  @IsString({ each: true })
  sources?: string[];
}
