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
    description: 'Statut d’abonnement actuel : { isPremium, plan? }',
  })
  @ApiNotFoundResponse({ description: 'Utilisateur introuvable' })
  getStatus(@Req() req: { user: { id: string } }) {
    return this.subscriptionService.getStatus(req.user.id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Subscribe (monthly or yearly) — DÉSACTIVÉ : le paiement en ligne n’est pas encore disponible. Retourne 501.',
    deprecated: true,
  })
  @ApiResponse({
    status: 501,
    description:
      'Le paiement en ligne arrive bientôt. Contactez un administrateur pour activer le premium.',
  })
  subscribe(@Req() _req: { user: { id: string } }, @Body() _dto: SubscribeDto) {
    throw new NotImplementedException(
      'Le paiement en ligne arrive bientôt. Contactez un administrateur pour activer le premium.',
    );
  }
}
