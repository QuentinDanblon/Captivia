import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnimalMeasurementsService } from './animal-measurements.service';
import {
  CreateAnimalMeasurementDto,
  UpdateAnimalMeasurementDto,
} from './dto/measurement.dto';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/measurements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnimalMeasurementsController {
  constructor(private readonly measurementsService: AnimalMeasurementsService) {}

  private ensurePremium(req: { user: { id: string; isPremium?: boolean } }) {
    if (!req.user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access animal measurements (carnet de santé).',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List weight/height measurements for an animal (sorted by measuredAt desc)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(@Req() req: { user: { id: string; isPremium?: boolean } }, @Param('animalId') animalId: string) {
    this.ensurePremium(req);
    return this.measurementsService.findAll(animalId, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a weight/height measurement (at least one of weightKg/heightCm required)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateAnimalMeasurementDto,
  ) {
    this.ensurePremium(req);
    return this.measurementsService.create(animalId, req.user.id, dto);
  }

  @Patch(':measurementId')
  @ApiOperation({ summary: 'Update a measurement' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'measurementId', description: 'Measurement ID' })
  async update(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('measurementId') measurementId: string,
    @Body() dto: UpdateAnimalMeasurementDto,
  ) {
    this.ensurePremium(req);
    return this.measurementsService.update(animalId, measurementId, req.user.id, dto);
  }

  @Delete(':measurementId')
  @ApiOperation({ summary: 'Delete a measurement' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'measurementId', description: 'Measurement ID' })
  async remove(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('measurementId') measurementId: string,
  ) {
    this.ensurePremium(req);
    return this.measurementsService.remove(animalId, measurementId, req.user.id);
  }
}
