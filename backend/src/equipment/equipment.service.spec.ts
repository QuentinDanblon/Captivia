import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentService } from './equipment.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EquipmentService', () => {
  let service: EquipmentService;

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
    speciesProfile: { findUnique: jest.fn(), findFirst: jest.fn() },
    recommendedEquipment: {
      count: jest.fn(),
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

    jest.clearAllMocks();
    mockPrismaService.speciesProfile.findFirst.mockResolvedValue(null);
    mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
      speciesId: 123,
      scientificName: 'Eublepharis macularius',
      category: 'reptile',
      habitats: [],
    });
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

    it('should limit general terrarium items to reptiles and temperature control', async () => {
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);

      await service.getRecommendedEquipment(123);

      expect(
        mockPrismaService.recommendedEquipment.findMany,
      ).toHaveBeenCalledWith({
        where: {
          OR: [
            { speciesId: 123 },
            {
              speciesId: null,
              category: { in: ['thermostat', 'thermometre'] },
            },
          ],
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it.each(['Canis familiaris', 'Canis lupus familiaris'])(
      'recommande couchage et gamelles pour %s, sans matériel de reptile',
      async (scientificName) => {
        mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
          speciesId: 123,
          scientificName,
          category: 'mammifère',
          habitats: [],
        });
        mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);
        const result = (await service.getRecommendedEquipment(123)) as {
          recommendations: { labelKey?: string }[];
        };
        expect(result.recommendations.map((rec) => rec.labelKey)).toEqual([
          'bed',
          'bowls',
          'dogToys',
        ]);
        expect(
          mockPrismaService.recommendedEquipment.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { OR: [{ speciesId: 123 }] },
          }),
        );
      },
    );

    it('recommande litière et griffoir aux races de chat', async () => {
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        speciesId: 2000000100,
        scientificName: 'Felis catus',
        category: 'mammifère',
        habitats: [],
      });
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);
      const result = (await service.getRecommendedEquipment(2000000100)) as {
        recommendations: { labelKey?: string }[];
      };
      expect(result.recommendations.map((rec) => rec.labelKey)).toEqual([
        'bed',
        'bowls',
        'litterTray',
        'scratchingPost',
      ]);
    });

    it.each([
      ['reptile', 'terrarium', 'terrarium'],
      ['poisson', 'aquarium', 'aquarium'],
      ['amphibien', 'aquaterrarium', 'aquaterrarium'],
      ['oiseau', 'volière', 'aviary'],
      ['mammifère', 'enclos', 'enclosure'],
      ['insecte', 'terrarium', 'terrarium'],
      ['arachnide', 'terrarium', 'terrarium'],
    ])('utilise l’habitat %s : %s', async (category, habitatType, labelKey) => {
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        speciesId: 123,
        scientificName: 'Species test',
        category,
        habitats: [
          { habitatType, activityEnrichment: '', lightNeeds: '', sources: [] },
        ],
      });
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);
      const result = (await service.getRecommendedEquipment(123)) as {
        recommendations: { labelKey?: string }[];
      };
      expect(result.recommendations.map((rec) => rec.labelKey)).toEqual([
        labelKey,
      ]);
    });

    it('ne remplace pas le matériel spécifique et conserve la pagination des suggestions', async () => {
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        speciesId: 123,
        scientificName: 'Felis catus',
        category: 'mammifère',
        habitats: [],
      });
      mockPrismaService.recommendedEquipment.count.mockResolvedValue(1);
      mockPrismaService.recommendedEquipment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ category: 'couchage' }]);
      const result = (await service.getRecommendedEquipment(
        123,
        undefined,
        undefined,
        { limit: 2, offset: 1 },
      )) as { recommendations: { labelKey?: string }[] };
      expect(result.recommendations.map((rec) => rec.labelKey)).toEqual([
        'bowls',
        'litterTray',
      ]);
    });

    it('une espèce inconnue ne reçoit pas le matériel général des reptiles', async () => {
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue(null);
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);
      await service.getRecommendedEquipment(999);
      expect(
        mockPrismaService.recommendedEquipment.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ speciesId: 999 }] },
        }),
      );
    });

    it('reprend l’habitat documenté du parent pour une race sans habitat propre', async () => {
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        speciesId: 2000000200,
        scientificName: 'Equus caballus',
        category: 'mammifère',
        habitats: [],
      });
      mockPrismaService.speciesProfile.findFirst.mockResolvedValue({
        habitats: [
          {
            habitatType: 'enclos',
            activityEnrichment: '',
            lightNeeds: '',
            sources: [],
          },
        ],
      });
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);
      const result = (await service.getRecommendedEquipment(2000000200)) as {
        recommendations: { labelKey?: string }[];
      };
      expect(result.recommendations.map((rec) => rec.labelKey)).toEqual([
        'enclosure',
      ]);
      expect(mockPrismaService.speciesProfile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scientificName: { equals: 'Equus caballus', mode: 'insensitive' },
            habitats: { some: { locale: 'fr' } },
          },
        }),
      );
    });

    it('respecte le filtre de catégorie et n’ajoute pas une taille inventée', async () => {
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        speciesId: 123,
        scientificName: 'Canis familiaris',
        category: 'mammifère',
        habitats: [],
      });
      mockPrismaService.recommendedEquipment.findMany.mockResolvedValue([]);
      const categoryResult = (await service.getRecommendedEquipment(
        123,
        'couchage',
      )) as { recommendations: { labelKey?: string }[] };
      expect(categoryResult.recommendations.map((rec) => rec.labelKey)).toEqual(
        ['bed'],
      );
      const sizeResult = (await service.getRecommendedEquipment(
        123,
        undefined,
        'small',
      )) as { recommendations: unknown[] };
      expect(sizeResult.recommendations).toEqual([]);
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
