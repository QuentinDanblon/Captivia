import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  CareReminderData,
  RenderedMail,
  renderCareReminder,
  renderPasswordReset,
} from './mail.templates';

export interface MailMessage extends RenderedMail {
  to: string;
}

export interface MailResult {
  /** true si le transport a accepté le message (SMTP) ou l'a sérialisé (jsonTransport). */
  sent: boolean;
  /** true si aucun SMTP n'est configuré (MAIL_HOST absent) : rien ne part réellement. */
  simulated: boolean;
  attempts: number;
}

/** 1 envoi + 2 nouvelles tentatives. */
export const MAIL_MAX_ATTEMPTS = 3;

/**
 * Service d'e-mail partagé (W3-01).
 *
 * - `MAIL_HOST` défini : SMTP (MAIL_PORT, MAIL_SECURE, MAIL_USER/MAIL_PASS, MAIL_FROM).
 * - `MAIL_HOST` absent : `jsonTransport` (rien n'est envoyé). Hors production, le message
 *   sérialisé est journalisé au niveau debug ; en production, jamais son contenu (liens).
 *
 * Ne lève jamais : les erreurs sont journalisées sans le contenu du message.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  readonly simulated: boolean;
  /** Délais entre tentatives (ms). Modifiable dans les tests. */
  retryDelaysMs: number[] = [500, 2000];

  constructor() {
    const host = process.env.MAIL_HOST?.trim();
    this.from = process.env.MAIL_FROM || 'Captivia <noreply@captivia.com>';
    this.simulated = !host;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.MAIL_PORT || '587', 10),
        secure: process.env.MAIL_SECURE === 'true',
        auth: process.env.MAIL_USER
          ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
          : undefined,
      });
    } else {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'MAIL_HOST non configuré : aucun e-mail ne sera réellement envoyé.',
        );
      }
    }
  }

  async send(message: MailMessage): Promise<MailResult> {
    let attempts = 0;
    for (;;) {
      attempts++;
      try {
        const info = (await this.transporter.sendMail({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        })) as { message?: unknown };
        if (this.simulated) this.logSimulated(info.message);
        return { sent: true, simulated: this.simulated, attempts };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        if (attempts >= MAIL_MAX_ATTEMPTS) {
          this.logger.error(
            `Échec d'envoi d'e-mail après ${attempts} tentatives : ${reason}`,
          );
          return { sent: false, simulated: this.simulated, attempts };
        }
        this.logger.warn(
          `Échec d'envoi d'e-mail (tentative ${attempts}/${MAIL_MAX_ATTEMPTS}) : ${reason}`,
        );
        await this.delay(this.retryDelaysMs[attempts - 1] ?? 0);
      }
    }
  }

  sendPasswordReset(
    to: string,
    locale: string | null | undefined,
    resetLink: string,
  ): Promise<MailResult> {
    return this.send({ to, ...renderPasswordReset(locale, resetLink) });
  }

  sendCareReminder(
    to: string,
    locale: string | null | undefined,
    data: CareReminderData,
  ): Promise<MailResult> {
    return this.send({ to, ...renderCareReminder(locale, data) });
  }

  private logSimulated(serialized: unknown): void {
    if (process.env.NODE_ENV === 'production') {
      this.logger.debug('E-mail simulé (MAIL_HOST absent) : contenu masqué.');
      return;
    }
    this.logger.debug(
      `E-mail simulé (MAIL_HOST absent) : ${typeof serialized === 'string' ? serialized : JSON.stringify(serialized)}`,
    );
  }

  private delay(ms: number): Promise<void> {
    return ms > 0
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : Promise.resolve();
  }
}
