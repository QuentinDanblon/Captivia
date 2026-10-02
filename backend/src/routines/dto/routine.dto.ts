import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';

const routineTypes = ['nourrissage', 'entretien', 'uvb', 'controle'] as const;
const frequencies = [
  'daily',
  'every_2_days',
  'every_3_days',
  'weekly',
  'monthly',
  'once',
  'hourly',
  'custom',
] as const;

export class CreateRoutineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsIn(routineTypes)
  type: string;

  @IsString()
  @IsIn(frequencies)
  frequency: string;

  @IsObject()
  schedule: any; // JSON object with horaires, saison, params personnalisés

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRoutineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(routineTypes)
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(frequencies)
  frequency?: string;

  @IsOptional()
  @IsObject()
  schedule?: any;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateActionLogDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
