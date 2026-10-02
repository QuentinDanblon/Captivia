import { Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { readVapidConfig, VapidConfig } from './vapid.config';

export type PushUrgency = 'very-low' | 'low' | 'normal' | 'high';

export interface PushReminderPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  /** Durée de vie (secondes) côté service push si l'appareil est hors ligne. Défaut : 1 h. */
  ttlSeconds?: number;
  /** Urgence Web Push (RFC 8030). Défaut : `normal`. */
  urgency?: PushUrgency;
}

/** Envoi de notifications push pour un utilisateur. Renvoie true si au moins un envoi a abouti. */
export interface PushSender {
  sendToUser(userId: string, payload: PushReminderPayload): Promise<boolean>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');

/** Bilan d'un envoi vers tous les appareils d'un utilisateur. */
export interface PushDeliveryResult {
  /** Appareils atteints. */
  sent: number;
  /** Appareils en échec (erreur transitoire ou clés invalides) : l'abonnement est conservé. */
  failed: number;
  /** Abonnements expirés (404/410) supprimés de la base. */
  removed: number;
}

/** Un rappel périmé n'a plus d'intérêt : 1 h de rétention max chez le service push. */
export const DEFAULT_PUSH_TTL_SECONDS = 60 * 60;
/** Évite qu'un service push lent bloque le cron de rappels. */
const PUSH_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_ICON = '/icons/icon-192.png';

/** Codes HTTP renvoyés quand l'abonnement n'existe plus (désinstallation, permission retirée). */
const GONE_STATUS_CODES = new Set([404, 410]);

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

/**
 * Implémentation Web Push (VAPID, bibliothèque `web-push`).
 *
 * Sans `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` valides, le sender est un no-op journalisé :
 * aucun envoi, `sendToUser` renvoie false et `GET /notifications/vapid-public-key` renvoie null.
 */
@Injectable()
export class WebPushSender implements PushSender {
  private readonly logger = new Logger(WebPushSender.name);
  private readonly vapid: VapidConfig | null;

  constructor(private readonly prisma: PrismaService) {
    this.vapid = this.initVapid();
  }

  /** Clé publique VAPID à transmettre au navigateur, ou null si le push est désactivé. */
  get publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  get enabled(): boolean {
    return this.vapid !== null;
  }

  async sendToUser(
    userId: string,
    payload: PushReminderPayload,
  ): Promise<boolean> {
    const res = await this.deliver(userId, payload);
    return res.sent > 0;
  }

  async deliver(
    userId: string,
    payload: PushReminderPayload,
  ): Promise<PushDeliveryResult> {
    const result: PushDeliveryResult = { sent: 0, failed: 0, removed: 0 };

    if (!this.vapid) {
      this.logger.debug(
        `Push désactivé (clés VAPID absentes) : rappel « ${payload.title} » pour ${userId} ignoré.`,
      );
      return result;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return result;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? DEFAULT_ICON,
      data: payload.data ?? {},
    });
    const options: webPush.RequestOptions = {
      TTL: Math.max(
        0,
        Math.floor(payload.ttlSeconds ?? DEFAULT_PUSH_TTL_SECONDS),
      ),
      urgency: payload.urgency ?? 'normal',
      timeout: PUSH_REQUEST_TIMEOUT_MS,
      vapidDetails: {
        subject: this.vapid.subject,
        publicKey: this.vapid.publicKey,
        privateKey: this.vapid.privateKey,
      },
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        const keys = sub.keys as { p256dh?: unknown; auth?: unknown } | null;
        if (
          !keys ||
          !isNonEmptyString(keys.p256dh) ||
          !isNonEmptyString(keys.auth)
        ) {
          this.logger.warn(`Abonnement push ${sub.id} ignoré : clés invalides.`);
          result.failed++;
          return;
        }
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: keys.p256dh, auth: keys.auth },
            },
            body,
            options,
          );
          result.sent++;
        } catch (error) {
          const status = (error as { statusCode?: number })?.statusCode;
          if (status !== undefined && GONE_STATUS_CODES.has(status)) {
            // Abonnement expiré : on le purge (deleteMany ne lève pas s'il a déjà disparu).
            await this.prisma.pushSubscription
              .deleteMany({ where: { id: sub.id } })
              .catch((e: unknown) =>
                this.logger.warn(
                  `Purge de l'abonnement ${sub.id} impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
                ),
              );
            result.removed++;
          } else {
            this.logger.warn(
              `Push vers l'abonnement ${sub.id} en échec (${status ?? 'réseau'}) : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
            );
            result.failed++;
          }
        }
      }),
    );

    return result;
  }

  private initVapid(): VapidConfig | null {
    const config = readVapidConfig();
    if (!config) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes : notifications push désactivées (no-op).',
      );
      return null;
    }
    try {
      // Valide le sujet et le format des clés (lève sinon).
      webPush.setVapidDetails(
        config.subject,
        config.publicKey,
        config.privateKey,
      );
      return config;
    } catch (error) {
      this.logger.error(
        `Clés VAPID invalides, notifications push désactivées : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
      return null;
    }
  }
}
