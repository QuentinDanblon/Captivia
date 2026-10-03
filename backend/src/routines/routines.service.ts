import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoutineDto,
  UpdateRoutineDto,
  CreateActionLogDto,
} from './dto/routine.dto';
import { ensureAnimalOwnership } from '../common/helpers/ownership.helper';
import { PaginationQueryDto, toPage } from '../common/dto/pagination-query.dto';
import { normalizeSchedule } from '../common/care-occurrences';

/**
 * « Une seule fois » sans date valide (YYYY-MM-DD) ne se déclencherait jamais
 * (`matchesSchedule`) : refusé en 400 plutôt qu'enregistré silencieusement.
 */
function assertOnceHasDate(frequency: string, schedule: unknown): void {
  const sch = normalizeSchedule(schedule);
  const recurrence = sch.recurrence ?? frequency;
  if ((recurrence === 'once' || frequency === 'once') && !sch.date) {
    throw new BadRequestException(
      'schedule.date (YYYY-MM-DD) is required for a one-time routine.',
    );
  }
}

@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoutine(
    userId: string,
    animalId: string,
    createRoutineDto: CreateRoutineDto,
  ) {
    await ensureAnimalOwnership(this.prisma, animalId, userId);
    assertOnceHasDate(createRoutineDto.frequency, createRoutineDto.schedule);

    return this.prisma.routine.create({
      data: {
        animalId,
        name: createRoutineDto.name || undefined,
        type: createRoutineDto.type,
        frequency: createRoutineDto.frequency,
        schedule: createRoutineDto.schedule,
        active:
          createRoutineDto.active !== undefined
            ? createRoutineDto.active
            : true,
      },
    });
  }

  async findAllRoutines(
    userId: string,
    animalId: string,
    page?: PaginationQueryDto,
  ) {
    await ensureAnimalOwnership(this.prisma, animalId, userId);

    return this.prisma.routine.findMany({
      where: { animalId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...toPage(page),
    });
  }

  async findOneRoutine(userId: string, animalId: string, routineId: string) {
    const routine = await this.prisma.routine.findUnique({
      where: { id: routineId },
      include: { animal: true },
    });

    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    if (routine.animalId !== animalId || routine.animal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return routine;
  }

  async updateRoutine(
    userId: string,
    animalId: string,
    routineId: string,
    updateRoutineDto: UpdateRoutineDto,
  ) {
    const existing = await this.findOneRoutine(userId, animalId, routineId);
    // Contrôle sur la fréquence et le planning finaux, seulement s'ils changent (une pause
    // reste possible pour une ancienne routine).
    if (
      updateRoutineDto.frequency !== undefined ||
      updateRoutineDto.schedule !== undefined
    ) {
      assertOnceHasDate(
        updateRoutineDto.frequency ?? existing.frequency,
        updateRoutineDto.schedule ?? existing.schedule,
      );
    }

    return this.prisma.routine.update({
      where: { id: routineId },
      data: updateRoutineDto,
    });
  }

  async deleteRoutine(userId: string, animalId: string, routineId: string) {
    await this.findOneRoutine(userId, animalId, routineId);

    return this.prisma.routine.delete({
      where: { id: routineId },
    });
  }

  async logAction(
    userId: string,
    animalId: string,
    createActionLogDto: CreateActionLogDto,
  ) {
    await ensureAnimalOwnership(this.prisma, animalId, userId);

    return this.prisma.actionLog.create({
      data: {
        animalId,
        type: createActionLogDto.type,
        note: createActionLogDto.note || null,
      },
    });
  }

  async getHistory(userId: string, animalId: string, limit = 100, offset = 0) {
    await ensureAnimalOwnership(this.prisma, animalId, userId);

    return this.prisma.actionLog.findMany({
      where: { animalId },
      orderBy: [{ doneAt: 'desc' }, { id: 'asc' }],
      take: limit,
      skip: offset,
    });
  }

  async deleteHistoryEntry(userId: string, animalId: string, logId: string) {
    const log = await this.prisma.actionLog.findUnique({
      where: { id: logId },
      include: { animal: true },
    });

    if (!log) {
      throw new NotFoundException('History entry not found');
    }

    if (log.animalId !== animalId || log.animal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.actionLog.delete({
      where: { id: logId },
    });
  }

  // Helper for notifications (Phase 3)
  async getActiveRoutines(userId: string) {
    const animals = await this.prisma.animal.findMany({
      where: { userId },
      include: {
        routines: {
          where: { active: true },
        },
      },
    });

    const allRoutines = animals.flatMap((animal) =>
      animal.routines.map((routine) => ({
        ...routine,
        animal: {
          id: animal.id,
          name: animal.name,
          speciesId: animal.speciesId,
        },
      })),
    );

    return allRoutines;
  }
}
