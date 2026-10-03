import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/animal.dto';

describe('AnimalsService', () => {
  let service: AnimalsService;
  let prismaService: PrismaService;

  const mockUserId = 'user-id-123';
  const mockAnimalId = 'animal-id-456';

  const mockUser = {
    id: mockUserId,
    email: 'test@captivia.com',
    passwordHash: 'hashed',
    locale: 'fr',
    isPremium: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { animals: 0 },
  };

  const mockAnimal = {
    id: mockAnimalId,
    userId: mockUserId,
    speciesId: 123,
    name: 'Rex',
    birthDate: new Date('2020-01-01'),
    sex: 'male',
    photos: ['photo1.jpg'],
    notes: 'Test notes',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Transaction context used by create() (prisma.$transaction(async (tx) => ...))
  const mockTx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-id-123' }]),
    user: {
      findUnique: jest.fn(),
      // EntitlementService.isPremium (W6-08) : aucun abonnement store dans ces tests.
      findFirst: jest.fn().mockResolvedValue(null),
    },
    animal: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    ),
    user: {
      findUnique: jest.fn(),
    },
    animal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalsService,
        EntitlementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnimalsService>(AnimalsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateAnimalDto = {
      speciesId: 123,
      name: 'Rex',
      birthDate: '2020-01-01',
      sex: 'male',
      photos: ['photo1.jpg'],
      notes: 'Test notes',
    };

    it('should create first animal for free user', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        ...mockUser,
        _count: { animals: 0 },
      });
      mockTx.animal.create.mockResolvedValue(mockAnimal);

      const result = await service.create(mockUserId, createDto);

      expect(result).toEqual(mockAnimal);
      expect(mockTx.animal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          speciesId: createDto.speciesId,
          name: createDto.name,
        }),
        include: expect.any(Object),
      });
    });

    it('should throw ForbiddenException when free user tries to create second animal', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        ...mockUser,
        isPremium: false,
        _count: { animals: 1 },
      });

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        'Free users can only have 1 animal',
      );
    });

    it('should allow premium user to create unlimited animals', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        ...mockUser,
        isPremium: true,
        _count: { animals: 5 },
      });
      mockTx.animal.create.mockResolvedValue(mockAnimal);

      const result = await service.create(mockUserId, createDto);

      expect(result).toEqual(mockAnimal);
      expect(mockTx.animal.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockTx.user.findUnique.mockResolvedValue(null);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should lock the user row (FOR UPDATE) before counting animals', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        ...mockUser,
        _count: { animals: 0 },
      });
      mockTx.animal.create.mockResolvedValue(mockAnimal);

      await service.create(mockUserId, createDto);

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      const strings = mockTx.$queryRaw.mock.calls[0][0] as string[];
      expect(strings.join('?')).toContain('FOR UPDATE');
      expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockTx.user.findUnique.mock.invocationCallOrder[0],
      );
    });

    it('should throw NotFoundException if the user row cannot be locked', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.animal.create).not.toHaveBeenCalled();
    });

    it('should handle null values correctly', async () => {
      const minimalDto: CreateAnimalDto = {
        speciesId: 123,
        name: 'Rex',
      };

      mockTx.user.findUnique.mockResolvedValue({
        ...mockUser,
        _count: { animals: 0 },
      });
      mockTx.animal.create.mockResolvedValue(mockAnimal);

      await service.create(mockUserId, minimalDto);

      expect(mockTx.animal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          birthDate: null,
          sex: null,
          photos: [],
          notes: null,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return all animals for a user', async () => {
      const animals = [mockAnimal, { ...mockAnimal, id: 'animal-2' }];
      mockPrismaService.animal.findMany.mockResolvedValue(animals);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual(animals);
      expect(mockPrismaService.animal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: expect.objectContaining({
          routines: expect.any(Object),
          _count: expect.any(Object),
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('should return empty array if user has no animals', async () => {
      mockPrismaService.animal.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return animal with routines and history', async () => {
      const animalWithRelations = {
        ...mockAnimal,
        routines: [],
        history: [],
      };
      mockPrismaService.animal.findUnique.mockResolvedValue(
        animalWithRelations,
      );

      const result = await service.findOne(mockAnimalId, mockUserId);

      expect(result).toEqual(animalWithRelations);
      expect(mockPrismaService.animal.findUnique).toHaveBeenCalledWith({
        where: { id: mockAnimalId },
        include: expect.objectContaining({
          routines: expect.any(Object),
          history: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundException if animal not found', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own animal', async () => {
      const otherUserAnimal = {
        ...mockAnimal,
        userId: 'other-user-id',
      };
      mockPrismaService.animal.findUnique.mockResolvedValue(otherUserAnimal);

      await expect(service.findOne(mockAnimalId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findOne(mockAnimalId, mockUserId)).rejects.toThrow(
        'Access denied',
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateAnimalDto = {
      name: 'Rex Updated',
      notes: 'Updated notes',
    };

    it('should update animal successfully', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.animal.update.mockResolvedValue({
        ...mockAnimal,
        ...updateDto,
      });

      const result = await service.update(mockAnimalId, mockUserId, updateDto);

      expect(result.name).toEqual(updateDto.name);
      expect(mockPrismaService.animal.update).toHaveBeenCalledWith({
        where: { id: mockAnimalId },
        data: expect.objectContaining(updateDto),
        include: expect.any(Object),
      });
    });

    it('should check ownership before updating', async () => {
      const otherUserAnimal = {
        ...mockAnimal,
        userId: 'other-user-id',
      };
      mockPrismaService.animal.findUnique.mockResolvedValue(otherUserAnimal);

      await expect(
        service.update(mockAnimalId, mockUserId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle partial updates', async () => {
      const partialUpdate: UpdateAnimalDto = {
        name: 'New Name',
      };

      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.animal.update.mockResolvedValue({
        ...mockAnimal,
        name: 'New Name',
      });

      await service.update(mockAnimalId, mockUserId, partialUpdate);

      expect(mockPrismaService.animal.update).toHaveBeenCalledWith({
        where: { id: mockAnimalId },
        data: { name: 'New Name' },
        include: {
          father: expect.any(Object),
          mother: expect.any(Object),
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete animal successfully', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(mockAnimal);
      mockPrismaService.animal.delete.mockResolvedValue(mockAnimal);

      const result = await service.remove(mockAnimalId, mockUserId);

      expect(result).toEqual(mockAnimal);
      expect(mockPrismaService.animal.delete).toHaveBeenCalledWith({
        where: { id: mockAnimalId },
      });
    });

    it('should check ownership before deleting', async () => {
      const otherUserAnimal = {
        ...mockAnimal,
        userId: 'other-user-id',
      };
      mockPrismaService.animal.findUnique.mockResolvedValue(otherUserAnimal);

      await expect(service.remove(mockAnimalId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if animal does not exist', async () => {
      mockPrismaService.animal.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAnimalCount', () => {
    it('should return the count of animals for a user', async () => {
      mockPrismaService.animal.count.mockResolvedValue(3);

      const result = await service.getAnimalCount(mockUserId);

      expect(result).toEqual(3);
      expect(mockPrismaService.animal.count).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should return 0 if user has no animals', async () => {
      mockPrismaService.animal.count.mockResolvedValue(0);

      const result = await service.getAnimalCount(mockUserId);

      expect(result).toEqual(0);
    });
  });
});
