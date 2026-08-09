import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { RoutinesService } from '../routines/routines.service';

@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly routinesService: RoutinesService,
  ) {}

  // Uncomment when @nestjs/schedule is installed:
  // @Cron(CronExpression.EVERY_HOUR)
  async checkRoutinesAndSendNotifications() {
    this.logger.log('Checking routines for notifications...');

    try {
      // Get all users
      const users = await this.prisma.user.findMany({
        select: { id: true },
      });

      for (const user of users) {
        await this.processUserRoutines(user.id);
      }

      this.logger.log('Routine notifications check completed');
    } catch (error) {
      this.logger.error('Error in routine notifications:', error);
    }
  }

  private async processUserRoutines(userId: string) {
    // Get all active routines for user
    const routines = await this.routinesService.getActiveRoutines(userId);

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    for (const routine of routines) {
      const shouldNotify = await this.shouldSendNotification(
        routine,
        currentHour,
        currentDay,
      );

      if (shouldNotify) {
        const canNotify = await this.notificationsService.checkIfShouldNotify(
          userId,
          routine.type,
        );

        if (canNotify) {
          await this.sendRoutineNotification(userId, routine);
        }
      }
    }
  }

  /** Mapping des noms de jours (format seed) vers getDay() JS : 0=dimanche … 6=samedi */
  private static readonly DAY_NAME_TO_INDEX: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  /**
   * Normalise les formats de schedule rencontrés :
   * - frontend : { time: '08:00', recurrence: 'daily', weekDay?, dayOfMonth?, date?, intervalHours? }
   * - seed :     { days: ['tuesday','friday'], time: '19:00' }
   * - ancien :   { hour: 8, day: 2, date: 15, hours: [8, 20] }
   */
  private normalizeSchedule(schedule: any): {
    hour?: number;
    hours?: number[];
    days?: number[];
    weekDay?: number;
    date?: string | number;
    dayOfMonth?: number;
    intervalHours?: number;
    recurrence?: string;
  } {
    const s = schedule && typeof schedule === 'object' ? schedule : {};

    let hour: number | undefined;
    if (typeof s.time === 'string' && s.time.includes(':')) {
      hour = Number(s.time.split(':')[0]);
    } else if (typeof s.hour === 'number') {
      hour = s.hour;
    }

    let hours: number[] | undefined;
    if (Array.isArray(s.hours)) {
      hours = s.hours.map(Number).filter((n: number) => !Number.isNaN(n));
    }

    let days: number[] | undefined;
    if (Array.isArray(s.days)) {
      const mapped = s.days
        .map((d: unknown) =>
          typeof d === 'number'
            ? d
            : NotificationsSchedulerService.DAY_NAME_TO_INDEX[String(d).toLowerCase()],
        )
        .filter((d: unknown): d is number => typeof d === 'number');
      days = mapped.length > 0 ? mapped : undefined;
    }

    const weekDay =
      typeof s.weekDay === 'number' ? s.weekDay : typeof s.day === 'number' ? s.day : undefined;
    const dayOfMonth = typeof s.dayOfMonth === 'number' ? s.dayOfMonth : undefined;
    const intervalHours = typeof s.intervalHours === 'number' ? s.intervalHours : undefined;
    const recurrence = typeof s.recurrence === 'string' ? s.recurrence : undefined;

    return { hour, hours, days, weekDay, date: s.date, dayOfMonth, intervalHours, recurrence };
  }

  private shouldSendNotification(
    routine: any,
    currentHour: number,
    currentDay: number,
  ): boolean {
    const schedule = this.normalizeSchedule(routine.schedule);
    // La récurrence peut être portée par le schedule (frontend) ou par la routine (seed/ancien)
    const frequency = schedule.recurrence ?? routine.frequency;

    switch (frequency) {
      case 'daily':
        // Check if hour matches
        return schedule.hour !== undefined && schedule.hour === currentHour;

      case 'weekly':
        // Check if day and hour match
        if (schedule.hour !== undefined && schedule.hour !== currentHour) return false;
        if (schedule.days && schedule.days.length > 0) {
          // Format seed : plusieurs jours par semaine (ex: ['tuesday','friday'])
          return schedule.days.includes(currentDay);
        }
        return schedule.weekDay !== undefined && schedule.weekDay === currentDay;

      case 'monthly':
        // Check if date and hour match
        if (schedule.hour !== undefined && schedule.hour !== currentHour) return false;
        const currentDate = new Date().getDate();
        if (schedule.date !== undefined && Number(schedule.date) === currentDate) return true;
        return schedule.dayOfMonth !== undefined && schedule.dayOfMonth === currentDate;

      case 'once':
        // Ne notifie que le jour précisé (YYYY-MM-DD) à l'heure donnée
        if (schedule.date === undefined || schedule.hour === undefined) return false;
        {
          const todayStr = new Date().toISOString().slice(0, 10);
          const dateStr = String(schedule.date).slice(0, 10);
          return dateStr === todayStr && schedule.hour === currentHour;
        }

      case 'every_2_days':
        if (schedule.hour !== undefined && schedule.hour !== currentHour) return false;
        return Math.floor(Date.now() / 86400000) % 2 === 0;

      case 'every_3_days':
        if (schedule.hour !== undefined && schedule.hour !== currentHour) return false;
        return Math.floor(Date.now() / 86400000) % 3 === 0;

      case 'hourly':
        if (schedule.hours && schedule.hours.length > 0) {
          return schedule.hours.includes(currentHour);
        }
        if (schedule.hour !== undefined) {
          const interval = Math.max(1, Math.min(24, schedule.intervalHours ?? 2));
          return (
            currentHour >= schedule.hour && (currentHour - schedule.hour) % interval === 0
          );
        }
        return false;

      case 'custom':
        // Custom logic based on schedule
        return !!(schedule.hours && schedule.hours.includes(currentHour));

      default:
        return false;
    }
  }

  private async sendRoutineNotification(userId: string, routine: any) {
    const typeLabels: Record<string, string> = {
      nourrissage: 'Nourrissage',
      entretien: 'Entretien',
      uvb: 'Contrôle UVB',
      controle: 'Contrôle santé',
    };

    const payload = {
      title: `Rappel: ${typeLabels[routine.type] || routine.type}`,
      body: `Il est temps de ${typeLabels[routine.type]?.toLowerCase()} pour ${routine.animal.name}`,
      icon: '/icon.png',
      data: {
        animalId: routine.animal.id,
        routineId: routine.id,
        type: routine.type,
      },
    };

    await this.notificationsService.sendNotification(userId, payload);

    this.logger.log(
      `Sent ${routine.type} notification for animal ${routine.animal.name}`,
    );
  }

  // Manual trigger for testing
  async triggerNotificationCheck() {
    await this.checkRoutinesAndSendNotifications();
    return { success: true, message: 'Notification check triggered' };
  }
}
