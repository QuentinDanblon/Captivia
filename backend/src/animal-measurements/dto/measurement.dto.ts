import {
  IsOptional,
  IsNumber,
  IsString,
  IsPositive,
  Max,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsValidDate } from '../../animals/dto/is-valid-date.decorator';

/** Poids et taille : strictement positifs (un poids de 0 ou négatif est une erreur de saisie). */
export class CreateAnimalMeasurementDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(10000)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
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
  @IsPositive()
  @Max(10000)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
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
