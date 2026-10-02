import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';

// Note: web-push library would be imported here in production
// import * as webPush from 'web-push';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {
    // In production, configure web-push:
    // const vapidKeys = {
    //   publicKey: process.env.VAPID_PUBLIC_KEY,
    //   privateKey: process.env.VAPID_PRIVATE_KEY,
    // };
    // webPush.setVapidDetails(
    //   'mailto:contact@captivia.com',
    //   vapidKeys.publicKey,
    //   vapidKeys.privateKey,
    // );
  }

  async subscribeToPush(
    userId: string,
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
  ) {
    const { endpoint, keys } = subscription;
    const forbidden = () =>
      new ForbiddenException(
        'This push endpoint is registered to another account',
      );

    // L'endpoint est unique globalement : un abonnement appartenant à un autre compte
    // ne doit jamais être écrasé ni « volé » (403).
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint },
    });
    if (existing) {
      if (existing.userId !== userId) throw forbidden();
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { keys },
      });
    }

    try {
      return await this.prisma.pushSubscription.create({
        data: { userId, endpoint, keys },
      });
    } catch (e) {
      // Création concurrente du même endpoint (P2002) : on relit pour décider.
      if ((e as { code?: string })?.code !== 'P2002') throw e;
      const again = await this.prisma.pushSubscription.findUnique({
        where: { endpoint },
      });
      if (!again || again.userId !== userId) throw forbidden();
      return this.prisma.pushSubscription.update({
        where: { id: again.id },
        data: { keys },
      });
    }
  }

  async unsubscribeFromPush(userId: string, endpoint: string) {
    const subscription = await this.prisma.pushSubscription.findFirst({
      where: {
        userId,
        endpoint,
      },
    });

    if (subscription) {
      await this.prisma.pushSubscription.delete({
        where: { id: subscription.id },
      });
    }

    return { success: true };
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
    });
  }

  async sendNotification(userId: string, payload: PushPayload) {
    const subscriptions = await this.getUserSubscriptions(userId);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        // In production, use web-push:
        // await webPush.sendNotification(
        //   {
        //     endpoint: sub.endpoint,
        //     keys: sub.keys as any,
        //   },
        //   JSON.stringify(payload),
        // );

        console.log(`[PUSH] Would send to ${sub.endpoint}:`, payload);
        return { success: true };
      }),
    );

    return {
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  async getNotificationPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Create default preferences if none exist
    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: {
          userId,
          types: {
            nourrissage: true,
            nettoyage: true,
            uvb: true,
            sante: true,
          },
          schedule: {
            start: '08:00',
            end: '22:00',
          },
          snooze: 15,
          deliveryChannel: 'push',
        },
      });
    }

    return prefs;
  }

  async updateNotificationPreferences(
    userId: string,
    data: UpdateNotificationPreferencesDto,
  ) {
    const existing = await this.getNotificationPreferences(userId);

    const updateData: Record<string, any> = {};
    if (data.types !== undefined) updateData.types = data.types;
    if (data.typeSchedules !== undefined)
      updateData.typeSchedules = data.typeSchedules;
    if (data.schedule !== undefined) updateData.schedule = data.schedule;
    if (data.snooze !== undefined) updateData.snooze = data.snooze;
    if (data.deliveryChannel !== undefined) {
      const valid = ['push', 'email', 'both'].includes(data.deliveryChannel)
        ? data.deliveryChannel
        : 'push';
      updateData.deliveryChannel = valid;
    }

    return this.prisma.notificationPreference.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  async checkIfShouldNotify(userId: string, type: string): Promise<boolean> {
    const prefs = await this.getNotificationPreferences(userId);

    // Check if type is enabled (types / schedule peuvent être nuls ou mal formés en base)
    const types =
      prefs.types &&
      typeof prefs.types === 'object' &&
      !Array.isArray(prefs.types)
        ? (prefs.types as Record<string, unknown>)
        : {};
    if (!types[type]) {
      return false;
    }

    // Check time window : sans fenêtre valide, aucune restriction horaire
    const schedule =
      prefs.schedule &&
      typeof prefs.schedule === 'object' &&
      !Array.isArray(prefs.schedule)
        ? (prefs.schedule as { start?: unknown; end?: unknown })
        : {};
    const start = typeof schedule.start === 'string' ? schedule.start : '00:00';
    const end = typeof schedule.end === 'string' ? schedule.end : '23:59';

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (currentTime < start || currentTime > end) {
      return false;
    }

    return true;
  }
}
