import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from '../animals/animals.service';
import {
  CreateAnimalMeasurementDto,
  UpdateAnimalMeasurementDto,
} from './dto/measurement.dto';
import {
  PaginationQueryDto,
  toPage,
} from '../common/dto/pagination-query.dto';


@Injectable()
export class AnimalMeasurementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  async findAll(animalId: string, userId: string, page?: PaginationQueryDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.animalMeasurement.findMany({
      where: { animalId },
      orderBy: [{ measuredAt: 'desc' }, { id: 'asc' }],
      ...toPage(page),
    });
  }

  async findOne(animalId: string, measurementId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    const measurement = await this.prisma.animalMeasurement.findFirst({
      where: { id: measurementId, animalId },
    });
    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }
    return measurement;
  }

  async create(animalId: string, userId: string, dto: CreateAnimalMeasurementDto) {
    await this.animalsService.findOne(animalId, userId);
    if (dto.weightKg === undefined && dto.heightCm === undefined) {
      throw new BadRequestException(
        'At least one of weightKg or heightCm is required for a measurement.',
      );
    }
    return this.prisma.animalMeasurement.create({
      data: {
        animalId,
        weightKg: dto.weightKg ?? null,
        heightCm: dto.heightCm ?? null,
        measuredAt: new Date(dto.measuredAt),
        notes: dto.notes ?? null,
      },
    });
  }

  async update(
    animalId: string,
    measurementId: string,
    userId: string,
    dto: UpdateAnimalMeasurementDto,
  ) {
    await this.findOne(animalId, measurementId, userId);
    const data: Record<string, unknown> = {};
    if (dto.weightKg !== undefined) data.weightKg = dto.weightKg;
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.measuredAt !== undefined) data.measuredAt = new Date(dto.measuredAt);
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.prisma.animalMeasurement.update({
      where: { id: measurementId },
      data,
    });
  }

  async remove(animalId: string, measurementId: string, userId: string) {
    await this.findOne(animalId, measurementId, userId);
    return this.prisma.animalMeasurement.delete({
      where: { id: measurementId },
    });
  }
}
