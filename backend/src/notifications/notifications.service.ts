import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    // Create or update push subscription
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      update: {
        keys: subscription.keys,
      },
    });
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
    data: {
      types?: any;
      typeSchedules?: Record<string, any>;
      schedule?: any;
      snooze?: number;
      deliveryChannel?: 'push' | 'email' | 'both';
    },
  ) {
    const existing = await this.getNotificationPreferences(userId);

    const updateData: Record<string, any> = {};
    if (data.types !== undefined) updateData.types = data.types;
    if (data.typeSchedules !== undefined) updateData.typeSchedules = data.typeSchedules;
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

    // Check if type is enabled
    const types = prefs.types as any;
    if (!types[type]) {
      return false;
    }

    // Check time window
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const schedule = prefs.schedule as any;

    if (currentTime < schedule.start || currentTime > schedule.end) {
      return false;
    }

    return true;
  }
}
