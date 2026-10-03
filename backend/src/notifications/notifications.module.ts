import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { PUSH_SENDER, WebPushSender } from './push-sender';
import { NativePushSender } from './native-push-sender';
import { PushDispatcher } from './push-dispatcher';
import { DeviceTokensController } from './device-tokens.controller';
import { DeviceTokensService } from './device-tokens.service';
import { VapidController } from './vapid.controller';
import { GradeModule } from '../grade/grade.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), GradeModule, MailModule],
  controllers: [
    NotificationsController,
    VapidController,
    DeviceTokensController,
  ],
  providers: [
    NotificationsService,
    NotificationsSchedulerService,
    WebPushSender,
    NativePushSender,
    PushDispatcher,
    DeviceTokensService,
    // Le scheduler et la notification de test passent par le dispatcher : Web Push + natif.
    { provide: PUSH_SENDER, useExisting: PushDispatcher },
  ],
  exports: [NotificationsService, NotificationsSchedulerService],
})
export class NotificationsModule {}
