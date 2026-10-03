import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from '../animals/animals.service';
import { CreateVaccinationDto, UpdateVaccinationDto } from './dto/vaccination.dto';
import {
  PaginationQueryDto,
  toPage,
} from '../common/dto/pagination-query.dto';


@Injectable()
export class VaccinationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  async findAll(animalId: string, userId: string, page?: PaginationQueryDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.vaccination.findMany({
      where: { animalId },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
      ...toPage(page),
    });
  }

  async findOne(animalId: string, vaccinationId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    const vaccination = await this.prisma.vaccination.findFirst({
      where: { id: vaccinationId, animalId },
    });
    if (!vaccination) {
      throw new NotFoundException('Vaccination not found');
    }
    return vaccination;
  }

  /** Le rappel (nextDueDate) ne peut pas être antérieur à la date du vaccin. */
  private assertNextDueDateValid(date: Date, nextDueDate?: string | null) {
    if (nextDueDate && new Date(nextDueDate).getTime() < date.getTime()) {
      throw new BadRequestException(
        'nextDueDate must be greater than or equal to the vaccination date.',
      );
    }
  }

  async create(animalId: string, userId: string, dto: CreateVaccinationDto) {
    await this.animalsService.findOne(animalId, userId);
    const date = new Date(dto.date);
    this.assertNextDueDateValid(date, dto.nextDueDate);
    return this.prisma.vaccination.create({
      data: {
        animalId,
        name: dto.name,
        date,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
        batchNumber: dto.batchNumber ?? null,
        vetName: dto.vetName ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async update(
    animalId: string,
    vaccinationId: string,
    userId: string,
    dto: UpdateVaccinationDto,
  ) {
    const existing = await this.findOne(animalId, vaccinationId, userId);
    const date = dto.date !== undefined ? new Date(dto.date) : existing.date;
    this.assertNextDueDateValid(date, dto.nextDueDate ?? (dto.nextDueDate === undefined ? existing.nextDueDate?.toISOString() : undefined));

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.nextDueDate !== undefined) data.nextDueDate = dto.nextDueDate ? new Date(dto.nextDueDate) : null;
    if (dto.batchNumber !== undefined) data.batchNumber = dto.batchNumber;
    if (dto.vetName !== undefined) data.vetName = dto.vetName;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.prisma.vaccination.update({
      where: { id: vaccinationId },
      data,
    });
  }

  async remove(animalId: string, vaccinationId: string, userId: string) {
    await this.findOne(animalId, vaccinationId, userId);
    return this.prisma.vaccination.delete({
      where: { id: vaccinationId },
    });
  }
}
