import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebPushSender } from './push-sender';

@ApiTags('notifications')
@Controller('notifications')
export class VapidController {
  constructor(private readonly pushSender: WebPushSender) {}

  /** Clé publique VAPID (publique par nature) : nécessaire à `pushManager.subscribe`. */
  @Get('vapid-public-key')
  @ApiOperation({
    summary: 'VAPID public key',
    description:
      'Clé publique VAPID pour l’abonnement Web Push. `publicKey` vaut null si le push n’est pas configuré.',
  })
  @ApiResponse({ status: 200, description: '{ publicKey: string | null }' })
  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.pushSender.publicKey };
  }
}
