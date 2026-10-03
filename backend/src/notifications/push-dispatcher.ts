import { Injectable, Logger } from '@nestjs/common';
import { NativePushSender } from './native-push-sender';
import {
  PushDeliveryResult,
  PushReminderPayload,
  PushSender,
  WebPushSender,
  emptyDelivery,
} from './push-sender';

/**
 * Dispatcher des notifications push (W6-07) : un même rappel part, en parallèle, sur tous les
 * canaux actifs de l'utilisateur — navigateurs abonnés (Web Push, VAPID) et installations de
 * l'app (FCM / APNs). Chaque appareil est sollicité au plus une fois : un abonnement Web Push
 * et un jeton natif désignent des appareils distincts (la WebView de l'app ne s'abonne jamais
 * au Web Push), les jetons sont uniques, et le scheduler réserve chaque rappel avant l'envoi.
 *
 * Un canal désactivé (clés absentes) ou en panne n'empêche jamais l'autre.
 */
@Injectable()
export class PushDispatcher implements PushSender {
  private readonly logger = new Logger(PushDispatcher.name);

  constructor(
    private readonly web: WebPushSender,
    private readonly native: NativePushSender,
  ) {}

  async sendToUser(
    userId: string,
    payload: PushReminderPayload,
  ): Promise<boolean> {
    const res = await this.deliver(userId, payload);
    return res.sent + (res.covered ?? 0) > 0;
  }

  async deliver(
    userId: string,
    payload: PushReminderPayload,
  ): Promise<PushDeliveryResult> {
    const safe = (channel: string, p: Promise<PushDeliveryResult>) =>
      p.catch((error: unknown) => {
        this.logger.warn(
          `Canal ${channel} en échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
        );
        return emptyDelivery();
      });
    const results = await Promise.all([
      safe('Web Push', this.web.deliver(userId, payload)),
      safe('natif', this.native.deliver(userId, payload)),
    ]);
    return results.reduce<PushDeliveryResult>(
      (acc, r) => ({
        sent: acc.sent + r.sent,
        failed: acc.failed + r.failed,
        removed: acc.removed + r.removed,
        covered: (acc.covered ?? 0) + (r.covered ?? 0),
      }),
      emptyDelivery(),
    );
  }
}
