import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DEVICE_TOKEN_THROTTLE } from '../config/throttle.config';
import { DeviceTokensService } from './device-tokens.service';
import {
  RegisterDeviceTokenDto,
  UnregisterDeviceTokenDto,
} from './dto/device-token.dto';

/** Jetons de push natif de l'app (W6-07). Invités compris (leurs rappels passent par le push). */
@ApiTags('notifications')
@Controller('users/me/device-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Throttle(DEVICE_TOKEN_THROTTLE)
export class DeviceTokensController {
  constructor(private readonly deviceTokens: DeviceTokensService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register this app installation for native push (FCM / APNs)',
    description:
      "Crée ou met à jour (lastSeenAt) le jeton FCM de l'appareil pour le compte connecté. Un jeton déjà lié à un autre compte lui est retiré. Réponse : { enabled, platform, lastSeenAt } — enabled vaut false si le push natif n'est pas configuré côté serveur.",
  })
  @ApiResponse({
    status: 200,
    description: '{ enabled, platform, lastSeenAt }',
  })
  @ApiResponse({ status: 400, description: 'Invalid token / platform' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  register(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.deviceTokens.register(req.user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unregister a native push token',
    description:
      'Retire le jeton du compte connecté (déconnexion, rappels coupés sur l’appareil). Idempotent.',
  })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  unregister(
    @Request() req: { user: { id: string } },
    @Body() dto: UnregisterDeviceTokenDto,
  ) {
    return this.deviceTokens.unregister(req.user.id, dto.token);
  }
}
