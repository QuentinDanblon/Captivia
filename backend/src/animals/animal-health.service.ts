import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from './animals.service';
import { CreateHealthRecordDto, UpdateHealthRecordDto } from './dto/health-record.dto';
import {
  PaginationQueryDto,
  toPage,
} from '../common/dto/pagination-query.dto';


@Injectable()
export class AnimalHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  async findAll(animalId: string, userId: string, page?: PaginationQueryDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.animalHealthRecord.findMany({
      where: { animalId },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
      ...toPage(page),
    });
  }

  async findOne(animalId: string, recordId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    const record = await this.prisma.animalHealthRecord.findFirst({
      where: { id: recordId, animalId },
    });
    if (!record) {
      throw new NotFoundException('Health record not found');
    }
    return record;
  }

  async create(animalId: string, userId: string, dto: CreateHealthRecordDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.animalHealthRecord.create({
      data: {
        animalId,
        type: dto.type,
        title: dto.title,
        date: new Date(dto.date),
        notes: dto.notes ?? null,
        details: dto.details ? (dto.details as object) : undefined,
      },
    });
  }

  async update(
    animalId: string,
    recordId: string,
    userId: string,
    dto: UpdateHealthRecordDto,
  ) {
    await this.findOne(animalId, recordId, userId);
    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.details !== undefined) data.details = dto.details as object;
    return this.prisma.animalHealthRecord.update({
      where: { id: recordId },
      data,
    });
  }

  async remove(animalId: string, recordId: string, userId: string) {
    await this.findOne(animalId, recordId, userId);
    return this.prisma.animalHealthRecord.delete({
      where: { id: recordId },
    });
  }
}
