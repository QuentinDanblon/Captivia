import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { PUSH_SENDER, WebPushSender } from './push-sender';
import { VapidController } from './vapid.controller';
import { GradeModule } from '../grade/grade.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), GradeModule, MailModule],
  controllers: [NotificationsController, VapidController],
  providers: [
    NotificationsService,
    NotificationsSchedulerService,
    WebPushSender,
    { provide: PUSH_SENDER, useExisting: WebPushSender },
  ],
  exports: [NotificationsService, NotificationsSchedulerService],
})
export class NotificationsModule {}
