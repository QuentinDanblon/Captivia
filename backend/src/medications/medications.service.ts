import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from '../animals/animals.service';
import { CreateMedicationDto, UpdateMedicationDto } from './dto/medication.dto';
import { PaginationQueryDto, toPage } from '../common/dto/pagination-query.dto';

@Injectable()
export class MedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  async findAll(animalId: string, userId: string, page?: PaginationQueryDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.medication.findMany({
      where: { animalId },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      ...toPage(page),
    });
  }

  async findOne(animalId: string, medicationId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    const medication = await this.prisma.medication.findFirst({
      where: { id: medicationId, animalId },
    });
    if (!medication) {
      throw new NotFoundException('Medication not found');
    }
    return medication;
  }

  /** La date de fin ne peut pas précéder la date de début (même règle que les rappels de vaccin). */
  private assertEndDateValid(startDate: Date, endDate?: string | Date | null) {
    if (endDate && new Date(endDate).getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'endDate must be greater than or equal to startDate.',
      );
    }
  }

  async create(animalId: string, userId: string, dto: CreateMedicationDto) {
    await this.animalsService.findOne(animalId, userId);
    this.assertEndDateValid(new Date(dto.startDate), dto.endDate);
    return this.prisma.medication.create({
      data: {
        animalId,
        name: dto.name,
        dose: dto.dose,
        unit: dto.unit ?? null,
        frequency: dto.frequency,
        intervalHours: dto.intervalHours ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes ?? null,
      },
    });
  }

  async update(
    animalId: string,
    medicationId: string,
    userId: string,
    dto: UpdateMedicationDto,
  ) {
    const existing = await this.findOne(animalId, medicationId, userId);
    // Contrôle sur les valeurs finales (champ modifié, sinon valeur enregistrée ; null = effacée),
    // seulement si une date change : arrêter un traitement ancien reste toujours possible.
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      this.assertEndDateValid(
        dto.startDate !== undefined
          ? new Date(dto.startDate)
          : existing.startDate,
        dto.endDate !== undefined ? dto.endDate : existing.endDate,
      );
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.dose !== undefined) data.dose = dto.dose;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.intervalHours !== undefined) data.intervalHours = dto.intervalHours;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.medication.update({
      where: { id: medicationId },
      data,
    });
  }

  async remove(animalId: string, medicationId: string, userId: string) {
    await this.findOne(animalId, medicationId, userId);
    return this.prisma.medication.delete({
      where: { id: medicationId },
    });
  }
}
