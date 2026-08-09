import { IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsIn(['push', 'email', 'both'])
  deliveryChannel?: 'push' | 'email' | 'both';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  snooze?: number;

  @IsOptional()
  @IsObject()
  types?: any;

  @IsOptional()
  @IsObject()
  typeSchedules?: Record<string, any>;

  @IsOptional()
  @IsObject()
  schedule?: any;
}
