import { Test, TestingModule } from '@nestjs/testing';
import { LegislationService } from './legislation.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpeciesPlusService } from './services/speciesplus.service';

describe('LegislationService', () => {
  let service: LegislationService;
  let prismaService: PrismaService;
  let speciesPlusService: SpeciesPlusService;

  const mockLegislation = {
    id: 'leg-id-123',
    speciesId: 123,
    country: 'FR',
    status: 'allowed',
    details: { notes: 'Allowed with permit' },
    sources: ['http://example.com'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    speciesLegislation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    speciesProfile: {
      findUnique: jest.fn(),
    },
  };

  const mockSpeciesPlusService = {
    isConfigured: jest.fn(),
    searchByScientificName: jest.fn(),
    getCitesLegislation: jest.fn(),
    getEULegislation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegislationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SpeciesPlusService,
          useValue: mockSpeciesPlusService,
        },
      ],
    }).compile();

    service = module.get<LegislationService>(LegislationService);
    prismaService = module.get<PrismaService>(PrismaService);
    speciesPlusService = module.get<SpeciesPlusService>(SpeciesPlusService);

    jest.clearAllMocks();
    // Par défaut : Species+ non configuré (pas de jeton)
    mockSpeciesPlusService.isConfigured.mockReturnValue(false);
    mockPrismaService.speciesProfile.findUnique.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSpeciesLegislation', () => {
    it('should return legislation for specific country', async () => {
      mockPrismaService.speciesLegislation.findUnique.mockResolvedValue(
        mockLegislation,
      );

      const result = await service.getSpeciesLegislation(123, 'fr');

      expect(result).toEqual({
        speciesId: 123,
        country: 'FR',
        editorial: [mockLegislation],
        speciesPlus: {
          status: 'disabled',
          cites: null,
          eu: null,
        },
        disclaimer: expect.any(String),
        sources: expect.any(Array),
      });
      expect(mockSpeciesPlusService.searchByScientificName).not.toHaveBeenCalled();
    });

    describe('Species+ configuré', () => {
      beforeEach(() => {
        mockSpeciesPlusService.isConfigured.mockReturnValue(true);
        mockPrismaService.speciesLegislation.findMany.mockResolvedValue([]);
      });

      it('renvoie les listes CITES / UE du taxon correspondant au nom scientifique', async () => {
        mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
          scientificName: 'Boa constrictor',
        });
        mockSpeciesPlusService.searchByScientificName.mockResolvedValue([
          { id: 99, full_name: 'Boa constrictor imperator' },
          { id: 7, full_name: 'Boa constrictor' },
        ]);
        mockSpeciesPlusService.getCitesLegislation.mockResolvedValue([{ appendix: 'II' }]);
        mockSpeciesPlusService.getEULegislation.mockResolvedValue([{ annex: 'B' }]);

        const result = await service.getSpeciesLegislation(2448340);

        expect(mockSpeciesPlusService.getCitesLegislation).toHaveBeenCalledWith(7);
        expect(result.speciesPlus).toEqual({
          status: 'ok',
          taxonId: 7,
          cites: [{ appendix: 'II' }],
          eu: [{ annex: 'B' }],
        });
      });

      it('pas de profil local : not_found, aucun appel Species+', async () => {
        const result = await service.getSpeciesLegislation(123);

        expect(result.speciesPlus).toEqual({ status: 'not_found', cites: null, eu: null });
        expect(mockSpeciesPlusService.searchByScientificName).not.toHaveBeenCalled();
      });

      it('Species+ en panne : fiche servie, statut unavailable (jamais de 500)', async () => {
        mockPrismaService.speciesProfile.findUnique.mockResolvedValue({
          scientificName: 'Boa constrictor',
        });
        mockSpeciesPlusService.searchByScientificName.mockRejectedValue(
          new Error('Species+ temporarily unavailable'),
        );

        const result = await service.getSpeciesLegislation(2448340);

        expect(result.speciesPlus).toEqual({ status: 'unavailable', cites: null, eu: null });
        expect(result.editorial).toEqual([]);
      });
    });

    it('should return all legislations if no country specified', async () => {
      mockPrismaService.speciesLegislation.findMany.mockResolvedValue([
        mockLegislation,
      ]);

      const result = await service.getSpeciesLegislation(123);

      expect(result.editorial).toEqual([mockLegislation]);
      expect(result.country).toBeUndefined();
    });

    it('should convert country code to uppercase', async () => {
      mockPrismaService.speciesLegislation.findUnique.mockResolvedValue(
        mockLegislation,
      );

      await service.getSpeciesLegislation(123, 'fr');

      expect(
        mockPrismaService.speciesLegislation.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          speciesId_country: {
            speciesId: 123,
            country: 'FR',
          },
        },
      });
    });

    it('should include disclaimer and sources', async () => {
      mockPrismaService.speciesLegislation.findUnique.mockResolvedValue(null);

      const result = await service.getSpeciesLegislation(123, 'FR');

      expect(result.disclaimer).toBeDefined();
      expect(result.sources).toBeInstanceOf(Array);
      expect(result.sources.length).toBeGreaterThan(0);
    });
  });

  describe('createOrUpdateLegislation', () => {
    const details = { notes: 'Test details' };
    const sources = ['http://test.com'];

    it('should upsert legislation', async () => {
      mockPrismaService.speciesLegislation.upsert.mockResolvedValue(
        mockLegislation,
      );

      const result = await service.createOrUpdateLegislation(
        123,
        'fr',
        'allowed',
        details,
        sources,
      );

      expect(result).toEqual(mockLegislation);
      expect(mockPrismaService.speciesLegislation.upsert).toHaveBeenCalledWith(
        {
          where: {
            speciesId_country: {
              speciesId: 123,
              country: 'FR',
            },
          },
          create: {
            speciesId: 123,
            country: 'FR',
            status: 'allowed',
            details,
            sources,
          },
          update: {
            status: 'allowed',
            details,
            sources,
          },
        },
      );
    });

    it('should convert country to uppercase', async () => {
      mockPrismaService.speciesLegislation.upsert.mockResolvedValue(
        mockLegislation,
      );

      await service.createOrUpdateLegislation(
        123,
        'de',
        'prohibited',
        details,
        sources,
      );

      expect(mockPrismaService.speciesLegislation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            speciesId_country: {
              speciesId: 123,
              country: 'DE',
            },
          },
        }),
      );
    });
  });

  describe('searchSpeciesPlus', () => {
    it('should search Species+ by scientific name', async () => {
      const mockResults = [{ id: 1, name: 'Boa constrictor' }];
      mockSpeciesPlusService.searchByScientificName.mockResolvedValue(
        mockResults,
      );

      const result = await service.searchSpeciesPlus('Boa constrictor');

      expect(result).toEqual(mockResults);
      expect(
        mockSpeciesPlusService.searchByScientificName,
      ).toHaveBeenCalledWith('Boa constrictor');
    });
  });

  describe('getCitesLegislation', () => {
    it('should get CITES legislation by taxon ID', async () => {
      const mockCites = { appendix: 'II', listing: 'active' };
      mockSpeciesPlusService.getCitesLegislation.mockResolvedValue(mockCites);

      const result = await service.getCitesLegislation(12345);

      expect(result).toEqual(mockCites);
      expect(mockSpeciesPlusService.getCitesLegislation).toHaveBeenCalledWith(
        12345,
      );
    });
  });

  describe('getEULegislation', () => {
    it('should get EU legislation by taxon ID', async () => {
      const mockEU = { annex: 'B', restrictions: [] };
      mockSpeciesPlusService.getEULegislation.mockResolvedValue(mockEU);

      const result = await service.getEULegislation(12345);

      expect(result).toEqual(mockEU);
      expect(mockSpeciesPlusService.getEULegislation).toHaveBeenCalledWith(
        12345,
      );
    });
  });
});
