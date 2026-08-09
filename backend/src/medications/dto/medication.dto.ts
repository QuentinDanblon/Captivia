import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsValidDate } from '../../animals/dto/is-valid-date.decorator';

export const MEDICATION_FREQUENCIES = ['daily', 'every_x_hours', 'weekly'] as const;
export type MedicationFrequency = (typeof MEDICATION_FREQUENCIES)[number];

export class CreateMedicationDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dose: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsString()
  @IsIn(MEDICATION_FREQUENCIES)
  frequency: MedicationFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  intervalHours?: number;

  @IsDateString()
  @IsValidDate()
  startDate: string;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @IsIn(MEDICATION_FREQUENCIES)
  frequency?: MedicationFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  intervalHours?: number;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
