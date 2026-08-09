import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsDateString,
  IsIn,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsValidDate } from './is-valid-date.decorator';

export class CreateAnimalDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  speciesId: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'unknown'])
  sex?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Module F — parenté & groupement
  @IsOptional()
  @IsUUID()
  fatherId?: string;

  @IsOptional()
  @IsUUID()
  motherId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  groupName?: string;
}

export class UpdateAnimalDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  speciesId?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'unknown'])
  sex?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Module F — parenté & groupement
  @IsOptional()
  @IsUUID()
  fatherId?: string;

  @IsOptional()
  @IsUUID()
  motherId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  groupName?: string;
}
