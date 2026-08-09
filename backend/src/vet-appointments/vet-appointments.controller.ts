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
import { VetAppointmentsService } from './vet-appointments.service';
import {
  CreateVetAppointmentDto,
  UpdateVetAppointmentDto,
} from './dto/vet-appointment.dto';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/vet-appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VetAppointmentsController {
  constructor(private readonly vetAppointmentsService: VetAppointmentsService) {}

  private ensurePremium(req: { user: { id: string; isPremium?: boolean } }) {
    if (!req.user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access vet appointments.',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List vet appointments for an animal (sorted by date desc)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(@Req() req: { user: { id: string; isPremium?: boolean } }, @Param('animalId') animalId: string) {
    this.ensurePremium(req);
    return this.vetAppointmentsService.findAll(animalId, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a vet appointment' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateVetAppointmentDto,
  ) {
    this.ensurePremium(req);
    return this.vetAppointmentsService.create(animalId, req.user.id, dto);
  }

  @Patch(':appointmentId')
  @ApiOperation({ summary: 'Update a vet appointment (including status)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'appointmentId', description: 'Vet appointment ID' })
  async update(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateVetAppointmentDto,
  ) {
    this.ensurePremium(req);
    return this.vetAppointmentsService.update(animalId, appointmentId, req.user.id, dto);
  }

  @Delete(':appointmentId')
  @ApiOperation({ summary: 'Delete a vet appointment' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'appointmentId', description: 'Vet appointment ID' })
  async remove(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    this.ensurePremium(req);
    return this.vetAppointmentsService.remove(animalId, appointmentId, req.user.id);
  }
}
