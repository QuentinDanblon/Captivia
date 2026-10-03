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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VaccinationsService } from './vaccinations.service';
import {
  CreateVaccinationDto,
  UpdateVaccinationDto,
} from './dto/vaccination.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('animals')
// D-16 : carnet de santé complet sans Premium (la limite porte sur le nombre d'animaux).
@Controller('users/me/animals/:animalId/vaccinations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List vaccinations for an animal (sorted by date desc)',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Query() page: PaginationQueryDto,
  ) {
    return this.vaccinationsService.findAll(animalId, req.user.id, page);
  }

  @Post()
  @ApiOperation({
    summary:
      'Add a vaccination (nextDueDate generates a reminder event on the due day)',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateVaccinationDto,
  ) {
    return this.vaccinationsService.create(animalId, req.user.id, dto);
  }

  @Patch(':vaccinationId')
  @ApiOperation({ summary: 'Update a vaccination' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'vaccinationId', description: 'Vaccination ID' })
  async update(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Param('vaccinationId') vaccinationId: string,
    @Body() dto: UpdateVaccinationDto,
  ) {
    return this.vaccinationsService.update(
      animalId,
      vaccinationId,
      req.user.id,
      dto,
    );
  }

  @Delete(':vaccinationId')
  @ApiOperation({ summary: 'Delete a vaccination' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'vaccinationId', description: 'Vaccination ID' })
  async remove(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Param('vaccinationId') vaccinationId: string,
  ) {
    return this.vaccinationsService.remove(
      animalId,
      vaccinationId,
      req.user.id,
    );
  }
}
