import { Test, TestingModule } from '@nestjs/testing';
import { HealthContentService } from './health-content.service';
import { PrismaService } from '../prisma/prisma.service';
import { PubmedService } from './services/pubmed.service';

describe('HealthContentService', () => {
  let service: HealthContentService;
  let prismaService: PrismaService;
  let pubmedService: PubmedService;

  const mockHealthContent = {
    id: 'health-id-123',
    speciesId: 123,
    locale: 'fr',
    diseases: [
      {
        name: 'Respiratory infection',
        symptoms: ['coughing', 'wheezing'],
        prevention: 'Clean environment',
      },
    ],
    sources: [{ title: 'Source 1', url: 'http://example.com' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    speciesHealthContent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    speciesProfile: {
      findUnique: jest.fn(),
    },
  };

  const mockPubmedService = {
    searchArticles: jest.fn(),
    searchBySpeciesAndDisease: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthContentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PubmedService,
          useValue: mockPubmedService,
        },
      ],
    }).compile();

    service = module.get<HealthContentService>(HealthContentService);
    prismaService = module.get<PrismaService>(PrismaService);
    pubmedService = module.get<PubmedService>(PubmedService);

    jest.clearAllMocks();
    mockPrismaService.speciesProfile.findUnique.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSpeciesHealth', () => {
    it('should return health content with editorial data', async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(
        mockHealthContent,
      );

      const result = await service.getSpeciesHealth(123, undefined, 'fr');

      expect(result).toEqual({
        speciesId: 123,
        locale: 'fr',
        editorial: {
          diseases: mockHealthContent.diseases,
          sources: mockHealthContent.sources,
          updatedAt: mockHealthContent.updatedAt,
        },
        pubmed: [],
        pubmedAvailable: true,
        disclaimer: expect.any(String),
      });
    });

    it("n'appelle pas PubMed sans profil local (pas de nom scientifique)", async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(null);

      await service.getSpeciesHealth(999);

      expect(mockPubmedService.searchBySpeciesAndDisease).not.toHaveBeenCalled();
    });

    it('renvoie les références PubMed réelles de l\'espèce (nom scientifique du profil)', async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(null);
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        scientificName: 'Boa constrictor',
      });
      const articles = [{ pmid: '1', title: 'Boa health' }];
      mockPubmedService.searchBySpeciesAndDisease.mockResolvedValue(articles);

      const result = await service.getSpeciesHealth(2448340, 'mites');

      expect(mockPubmedService.searchBySpeciesAndDisease).toHaveBeenCalledWith(
        'Boa constrictor',
        'mites',
      );
      expect(result.pubmed).toEqual(articles);
      expect(result.pubmedAvailable).toBe(true);
    });

    it('PubMed en panne : la fiche est servie (pas de 500), pubmedAvailable=false', async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(
        mockHealthContent,
      );
      mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
        scientificName: 'Boa constrictor',
      });
      mockPubmedService.searchBySpeciesAndDisease.mockRejectedValue(
        new Error('PubMed temporarily unavailable'),
      );

      const result = await service.getSpeciesHealth(2448340);

      expect(result.pubmed).toEqual([]);
      expect(result.pubmedAvailable).toBe(false);
      expect(result.editorial).not.toBeNull();
    });

    it('should return null editorial if no content found', async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.getSpeciesHealth(999, undefined, 'fr');

      expect(result.editorial).toBeNull();
    });

    it('should use default locale "fr" if not provided', async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.getSpeciesHealth(123);

      expect(result.locale).toEqual('fr');
      expect(
        mockPrismaService.speciesHealthContent.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          speciesId_locale: {
            speciesId: 123,
            locale: 'fr',
          },
        },
      });
    });

    it('should include disclaimer in response', async () => {
      mockPrismaService.speciesHealthContent.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.getSpeciesHealth(123);

      expect(result.disclaimer).toBeDefined();
      expect(result.disclaimer).toContain('vétérinaire');
    });
  });

  describe('createOrUpdateHealthContent', () => {
    const diseases = [{ name: 'Test disease' }];
    const sources = [{ title: 'Test source' }];

    it('should upsert health content', async () => {
      mockPrismaService.speciesHealthContent.upsert.mockResolvedValue(
        mockHealthContent,
      );

      const result = await service.createOrUpdateHealthContent(
        123,
        'fr',
        diseases,
        sources,
      );

      expect(result).toEqual(mockHealthContent);
      expect(
        mockPrismaService.speciesHealthContent.upsert,
      ).toHaveBeenCalledWith({
        where: {
          speciesId_locale: {
            speciesId: 123,
            locale: 'fr',
          },
        },
        create: {
          speciesId: 123,
          locale: 'fr',
          diseases,
          sources,
        },
        update: {
          diseases,
          sources,
        },
      });
    });
  });

  describe('createOrUpdateHealthContent — fiche inexistante (W1-09)', () => {
    it('convertit la violation de FK (P2003) en 404', async () => {
      mockPrismaService.speciesHealthContent.upsert.mockRejectedValue(
        Object.assign(new Error('FK'), { code: 'P2003' }),
      );
      await expect(
        service.createOrUpdateHealthContent(999, 'fr', [], []),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('searchPubMed', () => {
    it('should search PubMed with default maxResults', async () => {
      const mockArticles = [
        { pmid: '123', title: 'Test article' },
      ];
      mockPubmedService.searchArticles.mockResolvedValue(mockArticles);

      const result = await service.searchPubMed('reptile disease');

      expect(result).toEqual(mockArticles);
      expect(mockPubmedService.searchArticles).toHaveBeenCalledWith(
        'reptile disease',
        10,
      );
    });

    it('should respect custom maxResults', async () => {
      mockPubmedService.searchArticles.mockResolvedValue([]);

      await service.searchPubMed('test query', 20);

      expect(mockPubmedService.searchArticles).toHaveBeenCalledWith(
        'test query',
        20,
      );
    });
  });
});
