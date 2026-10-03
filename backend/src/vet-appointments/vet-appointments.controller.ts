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
import { VetAppointmentsService } from './vet-appointments.service';
import {
  CreateVetAppointmentDto,
  UpdateVetAppointmentDto,
} from './dto/vet-appointment.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('animals')
// D-16 : carnet de santé complet sans Premium (la limite porte sur le nombre d'animaux).
@Controller('users/me/animals/:animalId/vet-appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VetAppointmentsController {
  constructor(private readonly vetAppointmentsService: VetAppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List vet appointments for an animal (sorted by date desc)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Query() page: PaginationQueryDto,
  ) {
    return this.vetAppointmentsService.findAll(animalId, req.user.id, page);
  }

  @Post()
  @ApiOperation({ summary: 'Add a vet appointment' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateVetAppointmentDto,
  ) {
    return this.vetAppointmentsService.create(animalId, req.user.id, dto);
  }

  @Patch(':appointmentId')
  @ApiOperation({ summary: 'Update a vet appointment (including status)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'appointmentId', description: 'Vet appointment ID' })
  async update(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateVetAppointmentDto,
  ) {
    return this.vetAppointmentsService.update(animalId, appointmentId, req.user.id, dto);
  }

  @Delete(':appointmentId')
  @ApiOperation({ summary: 'Delete a vet appointment' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'appointmentId', description: 'Vet appointment ID' })
  async remove(
    @Req() req: { user: { id: string } },
    @Param('animalId') animalId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.vetAppointmentsService.remove(animalId, appointmentId, req.user.id);
  }
}
