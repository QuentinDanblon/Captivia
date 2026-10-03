import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';

export const HEALTH_RECORD_TYPES = [
  'vaccine',
  'surgery',
  'specific_food',
  'medical_history',
] as const;
export type HealthRecordType = (typeof HEALTH_RECORD_TYPES)[number];

export class CreateHealthRecordDto {
  @IsString()
  @IsIn(HEALTH_RECORD_TYPES)
  type: HealthRecordType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class UpdateHealthRecordDto {
  @IsOptional()
  @IsString()
  @IsIn(HEALTH_RECORD_TYPES)
  type?: HealthRecordType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
