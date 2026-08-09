import {
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Max,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsValidDate } from '../../animals/dto/is-valid-date.decorator';

export class CreateAnimalMeasurementDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  heightCm?: number;

  @IsDateString()
  @IsValidDate()
  measuredAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateAnimalMeasurementDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  heightCm?: number;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  measuredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
