import { Injectable, Logger } from '@nestjs/common';

export interface PushReminderPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Envoi de notifications push pour un utilisateur. Renvoie true si au moins un envoi a abouti. */
export interface PushSender {
  sendToUser(userId: string, payload: PushReminderPayload): Promise<boolean>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');

/**
 * TODO(W3-03) : remplacer par l'implémentation `web-push` + VAPID (purge des abonnements
 * en 404/410). D'ici là, aucun push n'est envoyé : le rappel est journalisé en debug.
 */
@Injectable()
export class NoopPushSender implements PushSender {
  private readonly logger = new Logger(NoopPushSender.name);

  sendToUser(userId: string, payload: PushReminderPayload): Promise<boolean> {
    this.logger.debug(
      `Push non implémenté (W3-03) : rappel « ${payload.title} » pour ${userId} ignoré.`,
    );
    return Promise.resolve(true);
  }
}
