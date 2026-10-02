import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CarnetExportService } from './carnet-export.service';

/**
 * Export du carnet de santé complet (JSON imprimable).
 * Pas de PDF pour l'instant : le frontend peut afficher/imprimer ce JSON.
 */
@ApiTags('animals')
// D-16 : carnet de santé complet sans Premium (la limite porte sur le nombre d'animaux).
@Controller('users/me/animals/:animalId/carnet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CarnetExportController {
  constructor(private readonly carnetExportService: CarnetExportService) {}

  @Get('export')
  @ApiOperation({
    summary:
      'Export the full health record (carnet de santé) as JSON — animal, health records, measurements, vaccinations, medications, vet appointments, routines, action logs',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async exportCarnet(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.carnetExportService.exportCarnet(animalId, req.user.id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return result.payload;
  }
}
