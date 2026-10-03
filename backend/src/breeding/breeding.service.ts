import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from '../animals/animals.service';
import {
  CreateBreedingRecordDto,
  UpdateBreedingRecordDto,
} from './dto/breeding-record.dto';
import {
  PaginationQueryDto,
  toPage,
} from '../common/dto/pagination-query.dto';


@Injectable()
export class BreedingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  /**
   * offspringCount est requis pour un événement de type 'birth'.
   */
  private validateBirthOffspringCount(
    eventType: string,
    offspringCount: number | null | undefined,
  ) {
    if (
      eventType === 'birth' &&
      (offspringCount === null || offspringCount === undefined)
    ) {
      throw new BadRequestException(
        'offspringCount is required when eventType is birth',
      );
    }
  }

  async findAll(animalId: string, userId: string, page?: PaginationQueryDto) {
    await this.animalsService.findOne(animalId, userId);
    return this.prisma.breedingRecord.findMany({
      where: { animalId },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
      ...toPage(page),
    });
  }

  async findOne(animalId: string, recordId: string, userId: string) {
    await this.animalsService.findOne(animalId, userId);
    const record = await this.prisma.breedingRecord.findFirst({
      where: { id: recordId, animalId },
    });
    if (!record) {
      throw new NotFoundException('Breeding record not found');
    }
    return record;
  }

  async create(animalId: string, userId: string, dto: CreateBreedingRecordDto) {
    await this.animalsService.findOne(animalId, userId);
    this.validateBirthOffspringCount(dto.eventType, dto.offspringCount);
    return this.prisma.breedingRecord.create({
      data: {
        animalId,
        eventType: dto.eventType,
        date: new Date(dto.date),
        partnerName: dto.partnerName ?? null,
        offspringCount: dto.offspringCount ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async update(
    animalId: string,
    recordId: string,
    userId: string,
    dto: UpdateBreedingRecordDto,
  ) {
    const existing = await this.findOne(animalId, recordId, userId);
    const eventType = dto.eventType ?? existing.eventType;
    const offspringCount =
      dto.offspringCount !== undefined
        ? dto.offspringCount
        : existing.offspringCount;
    this.validateBirthOffspringCount(eventType, offspringCount);

    const data: Record<string, unknown> = {};
    if (dto.eventType !== undefined) data.eventType = dto.eventType;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.partnerName !== undefined) data.partnerName = dto.partnerName;
    if (dto.offspringCount !== undefined)
      data.offspringCount = dto.offspringCount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.breedingRecord.update({
      where: { id: recordId },
      data,
    });
  }

  async remove(animalId: string, recordId: string, userId: string) {
    await this.findOne(animalId, recordId, userId);
    return this.prisma.breedingRecord.delete({
      where: { id: recordId },
    });
  }
}
