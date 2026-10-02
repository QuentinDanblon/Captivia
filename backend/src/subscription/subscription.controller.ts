import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { SubscribeDto } from './dto/subscribe.dto';

export const SUBSCRIBE_IN_APP_ONLY_MESSAGE =
  "Abonnement disponible dans l'application mobile Captivia (achats intégrés App Store / Google Play). Aucun paiement n'est proposé sur le web.";

@ApiTags('subscription')
@Controller('users/me/subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({
    status: 200,
    description:
      'Statut d’abonnement : { premium, source, status, productId, currentPeriodEnd, willRenew, manageUrl } (+ isPremium, plan? pour compatibilité)',
  })
  @ApiNotFoundResponse({ description: 'Utilisateur introuvable' })
  getStatus(@Req() req: { user: { id: string } }) {
    return this.subscriptionService.getStatus(req.user.id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Subscribe — DÉSACTIVÉ sur le web : l’abonnement se souscrit uniquement dans l’application mobile (achats intégrés App Store / Google Play). Retourne 501.',
    deprecated: true,
  })
  @ApiResponse({
    status: 501,
    description:
      "Abonnement disponible dans l'application mobile Captivia (pas de paiement web).",
  })
  subscribe(@Req() _req: { user: { id: string } }, @Body() _dto: SubscribeDto) {
    throw new NotImplementedException(SUBSCRIBE_IN_APP_ONLY_MESSAGE);
  }
}
