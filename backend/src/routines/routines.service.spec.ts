import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoutineDto,
  UpdateRoutineDto,
  CreateActionLogDto,
} from './dto/routine.dto';

describe('RoutinesService', () => {
  let service: RoutinesService;
  let prismaService: PrismaService;

  const mockUserId = 'user-id-123';
  const mockAnimalId = 'animal-id-456';
  const mockRoutineId = 'routine-id-789';
  const mockLogId = 'log-id-999';

  const mockAnimal = {
    id: mockAnimalId,
    userId: mockUserId,
    speciesId: 123,
    name: 'Rex',
    birthDate: new Date('2020-01-01'),
    sex: 'male',
    photos: [],
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoutine = {
    id: mockRoutineId,
    animalId: mockAnimalId,
    type: 'nourrissage',
    frequency: 'daily',
    schedule: { time: '08:00' },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    animal: mockAnimal,
  };

  const mockActionLog = {
    id: mockLogId,
    animalId: mockAnimalId,
    type: 'nourrissage',
    note: 'Fed successfully',
    doneAt: new Date(),
    animal: mockAnimal,
  };

  const mockPrismaService = {
    animal: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    routine: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    actionLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RoutinesService>(RoutinesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoutine', () => {
    const createDto: CreateRoutineDto = {
      type: 'nourrissage',
      frequency: 'daily',
      schedule: { time: '08:00' },
      active: true,
    };

    it('should create routine successfully', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.routine.create.mockResolvedValue(mockRoutine);

      const result = await service.createRoutine(
        mockUserId,
        mockAnimalId,
        createDto,
      );

      expect(result).toEqual(mockRoutine);
      expect(mockPrismaService.routine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          animalId: mockAnimalId,
          type: createDto.type,
          frequency: createDto.frequency,
          schedule: createDto.schedule,
        }),
      });
    });

    it('should throw NotFoundException if animal not found', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(null);

      await expect(
        service.createRoutine(mockUserId, mockAnimalId, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own animal', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue({
        ...mockAnimal,
        userId: 'other-user-id',
      });

      await expect(
        service.createRoutine(mockUserId, mockAnimalId, createDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should default active to true if not provided', async () => {
      const dtoWithoutActive: CreateRoutineDto = {
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '08:00' },
      };

      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.routine.create.mockResolvedValue(mockRoutine);

      await service.createRoutine(
        mockUserId,
        mockAnimalId,
        dtoWithoutActive,
      );

      expect(mockPrismaService.routine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          active: true,
        }),
      });
    });
  });

  describe('findAllRoutines', () => {
    it('should return all routines for an animal', async () => {
      const routines = [mockRoutine, { ...mockRoutine, id: 'routine-2' }];
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.routine.findMany.mockResolvedValue(routines);

      const result = await service.findAllRoutines(mockUserId, mockAnimalId);

      expect(result).toEqual(routines);
      expect(mockPrismaService.routine.findMany).toHaveBeenCalledWith({
        where: { animalId: mockAnimalId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('should check animal ownership', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue({
        ...mockAnimal,
        userId: 'other-user-id',
      });

      await expect(
        service.findAllRoutines(mockUserId, mockAnimalId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOneRoutine', () => {
    it('should return routine with animal', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(mockRoutine);

      const result = await service.findOneRoutine(
        mockUserId,
        mockAnimalId,
        mockRoutineId,
      );

      expect(result).toEqual(mockRoutine);
    });

    it('should throw NotFoundException if routine not found', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneRoutine(mockUserId, mockAnimalId, 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if wrong animal', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        ...mockRoutine,
        animalId: 'different-animal-id',
      });

      await expect(
        service.findOneRoutine(mockUserId, mockAnimalId, mockRoutineId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if wrong user', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        ...mockRoutine,
        animal: { ...mockAnimal, userId: 'other-user-id' },
      });

      await expect(
        service.findOneRoutine(mockUserId, mockAnimalId, mockRoutineId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRoutine', () => {
    const updateDto: UpdateRoutineDto = {
      active: false,
      schedule: { time: '09:00' },
    };

    it('should update routine successfully', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(mockRoutine);
      mockPrismaService.routine.update.mockResolvedValue({
        ...mockRoutine,
        ...updateDto,
      });

      const result = await service.updateRoutine(
        mockUserId,
        mockAnimalId,
        mockRoutineId,
        updateDto,
      );

      expect(result.active).toEqual(false);
      expect(mockPrismaService.routine.update).toHaveBeenCalledWith({
        where: { id: mockRoutineId },
        data: updateDto,
      });
    });
  });

  describe('deleteRoutine', () => {
    it('should delete routine successfully', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(mockRoutine);
      mockPrismaService.routine.delete.mockResolvedValue(mockRoutine);

      const result = await service.deleteRoutine(
        mockUserId,
        mockAnimalId,
        mockRoutineId,
      );

      expect(result).toEqual(mockRoutine);
      expect(mockPrismaService.routine.delete).toHaveBeenCalledWith({
        where: { id: mockRoutineId },
      });
    });
  });

  describe('logAction', () => {
    const createLogDto: CreateActionLogDto = {
      type: 'nourrissage',
      note: 'Fed successfully',
    };

    it('should create action log successfully', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.actionLog.create.mockResolvedValue(mockActionLog);

      const result = await service.logAction(
        mockUserId,
        mockAnimalId,
        createLogDto,
      );

      expect(result).toEqual(mockActionLog);
      expect(mockPrismaService.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          animalId: mockAnimalId,
          type: createLogDto.type,
          note: createLogDto.note,
        }),
      });
    });

    it('should check animal ownership', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue({
        ...mockAnimal,
        userId: 'other-user-id',
      });

      await expect(
        service.logAction(mockUserId, mockAnimalId, createLogDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getHistory', () => {
    it('should return action history with default limit', async () => {
      const logs = [mockActionLog];
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.actionLog.findMany.mockResolvedValue(logs);

      const result = await service.getHistory(mockUserId, mockAnimalId);

      expect(result).toEqual(logs);
      expect(mockPrismaService.actionLog.findMany).toHaveBeenCalledWith({
        where: { animalId: mockAnimalId },
        orderBy: [{ doneAt: 'desc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('should respect custom limit', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.actionLog.findMany.mockResolvedValue([]);

      await service.getHistory(mockUserId, mockAnimalId, 50);

      expect(mockPrismaService.actionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });

  describe('deleteHistoryEntry', () => {
    it('should delete history entry successfully', async () => {
      mockPrismaService.actionLog.findUnique.mockResolvedValue(mockActionLog);
      mockPrismaService.actionLog.delete.mockResolvedValue(mockActionLog);

      const result = await service.deleteHistoryEntry(
        mockUserId,
        mockAnimalId,
        mockLogId,
      );

      expect(result).toEqual(mockActionLog);
      expect(mockPrismaService.actionLog.delete).toHaveBeenCalledWith({
        where: { id: mockLogId },
      });
    });

    it('should check ownership before deleting', async () => {
      mockPrismaService.actionLog.findUnique.mockResolvedValue({
        ...mockActionLog,
        animal: { ...mockAnimal, userId: 'other-user-id' },
      });

      await expect(
        service.deleteHistoryEntry(mockUserId, mockAnimalId, mockLogId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getActiveRoutines', () => {
    it('should return all active routines for user', async () => {
      mockPrismaService.animal.findMany.mockResolvedValue([
        {
          ...mockAnimal,
          routines: [mockRoutine],
        },
      ]);

      const result = await service.getActiveRoutines(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('animal');
      expect(result[0].animal.id).toEqual(mockAnimalId);
    });
  });
});
