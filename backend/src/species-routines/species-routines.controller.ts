import {
  Controller,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpeciesRoutinesService } from './species-routines.service';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/routine-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpeciesRoutinesController {
  constructor(private readonly speciesRoutinesService: SpeciesRoutinesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get species routine templates for an animal',
    description:
      'Modèles de routines par défaut proposés pour l’espèce de l’animal ' +
      '(nourrissage, UVB, entretien…), triés par order. Accessible à tous les ' +
      'utilisateurs — ce sont des suggestions, pas des rappels actifs.',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiResponse({ status: 200, description: 'Routine templates list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async getRoutineTemplates(@Request() req, @Param('animalId') animalId: string) {
    return this.speciesRoutinesService.findTemplatesForAnimal(req.user.id, animalId);
  }
}
