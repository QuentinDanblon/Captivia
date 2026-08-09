import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from '../animals/animals.service';
import {
  CreateVetAppointmentDto,
  UpdateVetAppointmentDto,
} from './dto/vet-appointment.dto';

@Injectable()
export class VetAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  async findAll(animalId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.vetAppointment.findMany({
      where: { animalId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(animalId: string, appointmentId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    const appointment = await this.prisma.vetAppointment.findFirst({
      where: { id: appointmentId, animalId },
    });
    if (!appointment) {
      throw new NotFoundException('Vet appointment not found');
    }
    return appointment;
  }

  async create(animalId: string, userId: string, dto: CreateVetAppointmentDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.vetAppointment.create({
      data: {
        animalId,
        vetName: dto.vetName,
        reason: dto.reason ?? null,
        date: new Date(dto.date),
        location: dto.location ?? null,
        notes: dto.notes ?? null,
        reminderDays: dto.reminderDays ?? [7, 1],
      },
    });
  }

  async update(
    animalId: string,
    appointmentId: string,
    userId: string,
    dto: UpdateVetAppointmentDto,
  ) {
    await this.findOne(animalId, appointmentId, userId);
    const data: Record<string, unknown> = {};
    if (dto.vetName !== undefined) data.vetName = dto.vetName;
    if (dto.reason !== undefined) data.reason = dto.reason;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.reminderDays !== undefined) data.reminderDays = dto.reminderDays;
    return this.prisma.vetAppointment.update({
      where: { id: appointmentId },
      data,
    });
  }

  async remove(animalId: string, appointmentId: string, userId: string) {
    await this.findOne(animalId, appointmentId, userId);
    return this.prisma.vetAppointment.delete({
      where: { id: appointmentId },
    });
  }
}
