import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateHealthContentDto {
  @IsString()
  @Length(2, 2)
  locale: string;

  @IsArray()
  @IsObject({ each: true })
  diseases: any[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  sources?: any[];
}
