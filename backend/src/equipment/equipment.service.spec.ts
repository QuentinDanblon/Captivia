import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentService } from './equipment.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EquipmentService', () => {
  let service: EquipmentService;
  let prismaService: PrismaService;

  const mockEquipment = {
    id: 'equip-id-123',
    speciesId: 123,
    category: 'terrarium',
    label: 'Glass Terrarium',
    size: 'large',
    searchTerms: ['terrarium', 'glass', 'reptile'],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    recommendedEquipment: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EquipmentService>(EquipmentService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecommendedEquipment', () => {
    it('should return the editorial recommendations without any product list (no Amazon integration)', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([
        mockEquipment,
      ]);
      const result = await service.getRecommendedEquipment(123);

      expect(result).toEqual({
        speciesId: 123,
        category: undefined,
        size: undefined,
        recommendations: [
          {
            id: mockEquipment.id,
            label: mockEquipment.label,
            category: mockEquipment.category,
            size: mockEquipment.size,
            speciesId: mockEquipment.speciesId,
          },
        ],
        affiliate: {
          disclaimer: expect.any(String),
          transparencyUrl: '/transparency',
        },
      });
    });

    it('should filter by category', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);

      await service.getRecommendedEquipment(undefined, 'heating');

      expect(
        mockPrismaService.recommendedEquipment.findMany,
      ).toHaveBeenCalledWith({
        where: { category: 'heating' },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('should filter by size', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);

      await service.getRecommendedEquipment(undefined, undefined, 'small');

      expect(
        mockPrismaService.recommendedEquipment.findMany,
      ).toHaveBeenCalledWith({
        where: { size: 'small' },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('should include speciesId OR null in query when speciesId provided', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);

      await service.getRecommendedEquipment(123);

      expect(
        mockPrismaService.recommendedEquipment.findMany,
      ).toHaveBeenCalledWith({
        where: {
          OR: [{ speciesId: 123 }, { speciesId: null }],
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('ne renvoie jamais de liste de produits (aucune donnée inventée)', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([
        mockEquipment,
      ]);

      const result = (await service.getRecommendedEquipment(123)) as {
        recommendations: Array<Record<string, unknown>>;
      };

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0]).not.toHaveProperty('products');
      expect(result.recommendations[0]).not.toHaveProperty('searchTerms');
    });
  });

  describe('createRecommendation', () => {
    it('should create equipment recommendation', async () => {
      const createData = {
        speciesId: 123,
        category: 'terrarium',
        label: 'Test Equipment',
        size: 'medium',
        searchTerms: ['test', 'equipment'],
        order: 5,
      };

      mockPrismaService.recommendedEquipment.create.mockResolvedValue(
        mockEquipment,
      );

      const result = await service.createRecommendation(createData);

      expect(result).toEqual(mockEquipment);
      expect(
        mockPrismaService.recommendedEquipment.create,
      ).toHaveBeenCalledWith({
        data: createData,
      });
    });

    it('should default order to 0 if not provided', async () => {
      const createData = {
        category: 'terrarium',
        label: 'Test Equipment',
        searchTerms: ['test'],
      };

      mockPrismaService.recommendedEquipment.create.mockResolvedValue(
        mockEquipment,
      );

      await service.createRecommendation(createData);

      expect(
        mockPrismaService.recommendedEquipment.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 0,
        }),
      });
    });
  });

  describe('updateRecommendation', () => {
    it('should update equipment recommendation', async () => {
      const updateData = {
        label: 'Updated Label',
        order: 10,
      };

      mockPrismaService.recommendedEquipment.update.mockResolvedValue({
        ...mockEquipment,
        ...updateData,
      });

      const result = await service.updateRecommendation(
        'equip-123',
        updateData,
      );

      expect(result.label).toEqual('Updated Label');
      expect(
        mockPrismaService.recommendedEquipment.update,
      ).toHaveBeenCalledWith({
        where: { id: 'equip-123' },
        data: updateData,
      });
    });
  });

  describe('deleteRecommendation', () => {
    it('should delete equipment recommendation', async () => {
      mockPrismaService.recommendedEquipment.delete.mockResolvedValue(
        mockEquipment,
      );

      const result = await service.deleteRecommendation('equip-123');

      expect(result).toEqual(mockEquipment);
      expect(
        mockPrismaService.recommendedEquipment.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'equip-123' },
      });
    });
  });

  describe('getCategories', () => {
    it('should return distinct categories', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([
        { category: 'terrarium' },
        { category: 'heating' },
        { category: 'lighting' },
      ]);

      const result = await service.getCategories();

      expect(result).toEqual(['terrarium', 'heating', 'lighting']);
      expect(
        mockPrismaService.recommendedEquipment.findMany,
      ).toHaveBeenCalledWith({
        select: { category: true },
        distinct: ['category'],
      });
    });
  });
});
