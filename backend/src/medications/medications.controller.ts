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
import { MedicationsService } from './medications.service';
import { CreateMedicationDto, UpdateMedicationDto } from './dto/medication.dto';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/medications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  private ensurePremium(req: { user: { id: string; isPremium?: boolean } }) {
    if (!req.user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access medication reminders.',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List medications for an animal (sorted by startDate desc)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(@Req() req: { user: { id: string; isPremium?: boolean } }, @Param('animalId') animalId: string) {
    this.ensurePremium(req);
    return this.medicationsService.findAll(animalId, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a medication reminder' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateMedicationDto,
  ) {
    this.ensurePremium(req);
    return this.medicationsService.create(animalId, req.user.id, dto);
  }

  @Patch(':medicationId')
  @ApiOperation({ summary: 'Update a medication (including active:false to stop)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'medicationId', description: 'Medication ID' })
  async update(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('medicationId') medicationId: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    this.ensurePremium(req);
    return this.medicationsService.update(animalId, medicationId, req.user.id, dto);
  }

  @Delete(':medicationId')
  @ApiOperation({ summary: 'Delete a medication' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'medicationId', description: 'Medication ID' })
  async remove(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('medicationId') medicationId: string,
  ) {
    this.ensurePremium(req);
    return this.medicationsService.remove(animalId, medicationId, req.user.id);
  }
}
