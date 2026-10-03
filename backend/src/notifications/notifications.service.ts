import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { PushReminderPayload } from './push-sender';
import { PushDispatcher } from './push-dispatcher';
import { isAllowedPushEndpoint } from './push-endpoint';

/** Nombre maximal d'abonnements push par compte : au-delà, le plus ancien est remplacé. */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    /** Web Push + push natif (W6-07). */
    private readonly pushSender: PushDispatcher,
  ) {}

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
    // Défense en profondeur : le DTO l'a déjà vérifié (liste blanche des services push).
    if (!isAllowedPushEndpoint(endpoint)) {
      throw new BadRequestException(
        'endpoint must be an https URL of a supported Web Push service',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verrou User : le plafond d'abonnements tient même sous inscriptions concurrentes.
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        // L'endpoint est unique globalement : un abonnement appartenant à un autre compte
        // ne doit jamais être écrasé ni « volé » (403).
        const existing = await tx.pushSubscription.findUnique({
          where: { endpoint },
        });
        if (existing) {
          if (existing.userId !== userId) throw forbidden();
          return tx.pushSubscription.update({
            where: { id: existing.id },
            data: { keys },
          });
        }
        // Plafond par compte : les abonnements les plus anciens sont remplacés.
        const current = await tx.pushSubscription.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
        const excess = current.length - (MAX_PUSH_SUBSCRIPTIONS_PER_USER - 1);
        if (excess > 0) {
          await tx.pushSubscription.deleteMany({
            where: { id: { in: current.slice(0, excess).map((c) => c.id) } },
          });
        }
        return tx.pushSubscription.create({
          data: { userId, endpoint, keys },
        });
      });
    } catch (e) {
      // Création concurrente du même endpoint par un autre compte (P2002) : on relit pour décider.
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

  /**
   * Envoi immédiat vers tous les appareils de l'utilisateur (notification de test) : navigateurs
   * abonnés et installations de l'app.
   * Ne renvoie QUE « au moins un envoi a réussi » : le détail (échecs, purges) servait d'oracle
   * pour sonder des adresses (revue de sécurité, constat 2).
   */
  async sendNotification(
    userId: string,
    payload: PushReminderPayload,
  ): Promise<{ sent: boolean }> {
    const { sent } = await this.pushSender.deliver(userId, payload);
    return { sent: sent > 0 };
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

    const updateData: Prisma.NotificationPreferenceUpdateInput = {};
    if (data.types !== undefined) updateData.types = data.types;
    // DTO validés (objets simples) : stockés tels quels dans les colonnes JSON.
    if (data.typeSchedules !== undefined)
      updateData.typeSchedules = data.typeSchedules as Prisma.InputJsonValue;
    if (data.schedule !== undefined)
      updateData.schedule = data.schedule as Prisma.InputJsonValue;
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
