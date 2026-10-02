import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { NoopPushSender, PUSH_SENDER } from './push-sender';
import { GradeModule } from '../grade/grade.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), GradeModule, MailModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsSchedulerService,
    // TODO(W3-03) : brancher l'implémentation web-push réelle.
    { provide: PUSH_SENDER, useClass: NoopPushSender },
  ],
  exports: [NotificationsService, NotificationsSchedulerService],
})
export class NotificationsModule {}
