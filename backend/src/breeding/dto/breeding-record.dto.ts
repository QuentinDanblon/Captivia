import {
  IsString,
  IsOptional,
  MaxLength,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsValidDate } from '../../animals/dto/is-valid-date.decorator';

export const BREEDING_EVENT_TYPES = [
  'heat',
  'mating',
  'pregnancy',
  'birth',
  'weaning',
] as const;
export type BreedingEventType = (typeof BREEDING_EVENT_TYPES)[number];

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBreedingRecordDto {
  @IsString()
  @IsIn(BREEDING_EVENT_TYPES)
  eventType: BreedingEventType;

  @IsDateString()
  @IsValidDate()
  date: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  partnerName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  offspringCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateBreedingRecordDto {
  @IsOptional()
  @IsString()
  @IsIn(BREEDING_EVENT_TYPES)
  eventType?: BreedingEventType;

  @IsOptional()
  @IsDateString()
  @IsValidDate()
  date?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  partnerName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  offspringCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
