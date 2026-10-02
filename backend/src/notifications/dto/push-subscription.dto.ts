import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsUrl,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  IsAllowedPushEndpoint,
  PUSH_ENDPOINT_MAX_LENGTH,
} from '../push-endpoint';

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
  // Les services Web Push sont toujours en https (refuse http:, javascript:, data:, etc.), et
  // seuls les services connus sont acceptés (anti-SSRF : jamais d'adresse interne ni de port exotique).
  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_ENDPOINT_MAX_LENGTH)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @IsAllowedPushEndpoint()
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_ENDPOINT_MAX_LENGTH)
  endpoint: string;
}
