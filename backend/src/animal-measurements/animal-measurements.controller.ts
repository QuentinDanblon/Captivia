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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnimalMeasurementsService } from './animal-measurements.service';
import {
  CreateAnimalMeasurementDto,
  UpdateAnimalMeasurementDto,
} from './dto/measurement.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('animals')
// D-16 : carnet de santé complet sans Premium (la limite porte sur le nombre d'animaux).
@Controller('users/me/animals/:animalId/measurements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnimalMeasurementsController {
  constructor(private readonly measurementsService: AnimalMeasurementsService) {}

  @Get()
  @ApiOperation({ summary: 'List weight/height measurements for an animal (sorted by measuredAt desc)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Query() page: PaginationQueryDto,
  ) {
    return this.measurementsService.findAll(animalId, req.user.id, page);
  }

  @Post()
  @ApiOperation({ summary: 'Add a weight/height measurement (at least one of weightKg/heightCm required)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateAnimalMeasurementDto,
  ) {
    return this.measurementsService.create(animalId, req.user.id, dto);
  }

  @Patch(':measurementId')
  @ApiOperation({ summary: 'Update a measurement' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'measurementId', description: 'Measurement ID' })
  async update(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Param('measurementId') measurementId: string,
    @Body() dto: UpdateAnimalMeasurementDto,
  ) {
    return this.measurementsService.update(animalId, measurementId, req.user.id, dto);
  }

  @Delete(':measurementId')
  @ApiOperation({ summary: 'Delete a measurement' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'measurementId', description: 'Measurement ID' })
  async remove(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Param('measurementId') measurementId: string,
  ) {
    return this.measurementsService.remove(animalId, measurementId, req.user.id);
  }
}
