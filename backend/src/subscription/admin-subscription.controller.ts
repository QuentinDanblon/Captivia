import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';
import { SubscriptionService } from './subscription.service';
import { AdminActivatePremiumDto } from './dto/admin-activate-premium.dto';

/**
 * Administration du premium, réservée aux opérateurs (User.role = OPERATOR, attribué via `npm run operator:set`).
 * L'activation automatique sans paiement (POST /users/me/subscription) étant
 * désactivée (501), c'est le seul moyen de rendre un compte premium.
 */
@ApiTags('admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, OperatorGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({
  description: "L'appelant n'est pas un opérateur (User.role ≠ OPERATOR)",
})
export class AdminSubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post(':userId/premium')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Activer le premium d'un utilisateur (opérateur uniquement). Le body {email} est un champ de confirmation facultatif : s'il est fourni, il doit correspondre au compte ciblé.",
  })
  @ApiResponse({
    status: 200,
    description:
      'Premium activé — retourne le nouveau statut : { isPremium, plan? }',
  })
  @ApiResponse({
    status: 400,
    description:
      "L'email fourni dans le body ne correspond pas au compte cible",
  })
  @ApiNotFoundResponse({ description: 'Utilisateur cible introuvable' })
  activate(
    @Param('userId') userId: string,
    @Body() dto: AdminActivatePremiumDto,
  ) {
    return this.subscriptionService.activatePremium(userId, dto.email);
  }

  @Delete(':userId/premium')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Désactiver le premium d'un utilisateur (résiliation manuelle, opérateur uniquement).",
  })
  @ApiResponse({
    status: 200,
    description:
      'Premium désactivé — retourne le nouveau statut : { isPremium, plan? }',
  })
  @ApiNotFoundResponse({ description: 'Utilisateur cible introuvable' })
  deactivate(@Param('userId') userId: string) {
    return this.subscriptionService.deactivatePremium(userId);
  }
}
