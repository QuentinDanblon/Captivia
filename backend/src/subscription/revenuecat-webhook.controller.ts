import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  RevenueCatEvent,
  RevenueCatWebhookService,
  safeSecretEqual,
} from './revenuecat-webhook.service';

/** Taille maximale acceptée (un événement RevenueCat fait quelques Ko). */
export const REVENUECAT_MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /webhooks/revenuecat (W6-08) — notifications d'achats intégrés App Store / Google Play.
 * Authentification : en-tête `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` (valeur
 * saisie dans RevenueCat > Integrations > Webhooks), comparé en temps constant.
 * Pas de throttling (RevenueCat rejoue en rafale après incident) ; corps limité à 64 Ko.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('webhooks/revenuecat')
export class RevenueCatWebhookController {
  private readonly logger = new Logger(RevenueCatWebhookController.name);

  constructor(private readonly webhook: RevenueCatWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Headers('authorization') authorization: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Body() body: { api_version?: string; event?: RevenueCatEvent } | undefined,
  ): Promise<{ received: true; outcome: string }> {
    const secret = (process.env.REVENUECAT_WEBHOOK_SECRET || '').trim();
    if (!secret) {
      this.logger.warn(
        'REVENUECAT_WEBHOOK_SECRET non configuré : webhook RevenueCat refusé',
      );
      throw new UnauthorizedException();
    }
    const provided = (authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!provided || !safeSecretEqual(provided, secret)) {
      throw new UnauthorizedException();
    }
    if (Number(contentLength) > REVENUECAT_MAX_BODY_BYTES) {
      throw new PayloadTooLargeException();
    }

    const event = body?.event;
    if (!event || typeof event !== 'object') {
      return { received: true, outcome: 'ignored_invalid' };
    }
    const outcome = await this.webhook.handle(event);
    return { received: true, outcome };
  }
}
