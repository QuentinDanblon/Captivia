import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import type { Prisma } from '@prisma/client';

export class CreateHealthContentDto {
  @IsString()
  @Length(2, 2)
  locale: string;

  @IsArray()
  @IsObject({ each: true })
  diseases: Prisma.InputJsonObject[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  sources?: Prisma.InputJsonObject[];
}
