import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsUrl,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  auth: string;
}

export class PushSubscriptionDto {
  // Les services Web Push sont toujours en https (refuse http:, javascript:, data:, etc.)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  endpoint: string;
}
