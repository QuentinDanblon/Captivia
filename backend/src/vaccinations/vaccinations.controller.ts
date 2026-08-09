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
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto, UpdateVaccinationDto } from './dto/vaccination.dto';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/vaccinations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  private ensurePremium(req: { user: { id: string; isPremium?: boolean } }) {
    if (!req.user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access vaccinations (carnet de santé).',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List vaccinations for an animal (sorted by date desc)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(@Req() req: { user: { id: string; isPremium?: boolean } }, @Param('animalId') animalId: string) {
    this.ensurePremium(req);
    return this.vaccinationsService.findAll(animalId, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a vaccination (nextDueDate generates a reminder event on the due day)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateVaccinationDto,
  ) {
    this.ensurePremium(req);
    return this.vaccinationsService.create(animalId, req.user.id, dto);
  }

  @Patch(':vaccinationId')
  @ApiOperation({ summary: 'Update a vaccination' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'vaccinationId', description: 'Vaccination ID' })
  async update(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('vaccinationId') vaccinationId: string,
    @Body() dto: UpdateVaccinationDto,
  ) {
    this.ensurePremium(req);
    return this.vaccinationsService.update(animalId, vaccinationId, req.user.id, dto);
  }

  @Delete(':vaccinationId')
  @ApiOperation({ summary: 'Delete a vaccination' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'vaccinationId', description: 'Vaccination ID' })
  async remove(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('vaccinationId') vaccinationId: string,
  ) {
    this.ensurePremium(req);
    return this.vaccinationsService.remove(animalId, vaccinationId, req.user.id);
  }
}
