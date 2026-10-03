import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsValidDate } from '../../animals/dto/is-valid-date.decorator';

export const VET_APPOINTMENT_STATUSES = [
  'scheduled',
  'done',
  'cancelled',
] as const;
export type VetAppointmentStatus = (typeof VET_APPOINTMENT_STATUSES)[number];

export class CreateVetAppointmentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vetName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsDateString()
  @IsValidDate()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(30, { each: true })
  reminderDays?: number[];
}

export class UpdateVetAppointmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vetName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(VET_APPOINTMENT_STATUSES)
  status?: VetAppointmentStatus;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(30, { each: true })
  reminderDays?: number[];
}
