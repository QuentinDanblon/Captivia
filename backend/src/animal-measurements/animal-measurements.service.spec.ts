import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AnimalMeasurementsService } from './animal-measurements.service';
import { CreateAnimalMeasurementDto } from './dto/measurement.dto';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnimalsService } from '../animals/animals.service';

describe('Mesures (poids / taille)', () => {
  it.each([0, -1])(
    'DTO : poids ou taille %p refusé (strictement positif)',
    (value) => {
      const errors = validateSync(
        plainToInstance(CreateAnimalMeasurementDto, {
          measuredAt: '2026-10-01',
          weightKg: value,
          heightCm: value,
        }),
      ).map((e) => e.property);
      expect(errors).toEqual(['weightKg', 'heightCm']);
    },
  );

  it('DTO : 4.25 kg accepté', () => {
    expect(
      validateSync(
        plainToInstance(CreateAnimalMeasurementDto, {
          measuredAt: '2026-10-01',
          weightKg: 4.25,
        }),
      ),
    ).toEqual([]);
  });

  describe('service', () => {
    const prisma = {
      animalMeasurement: {
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
        update: jest.fn().mockResolvedValue({ id: 'm1' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'm1',
          animalId: 'a1',
          weightKg: 4.2,
          heightCm: null,
        }),
      },
    };
    const animals = { findOne: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const service = new AnimalMeasurementsService(
      prisma as unknown as PrismaService,
      animals as unknown as AnimalsService,
    );

    beforeEach(() => jest.clearAllMocks());

    it('création sans poids ni taille (ou à null) → 400', async () => {
      await expect(
        service.create('a1', 'u1', { measuredAt: '2026-10-01' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('a1', 'u1', {
          measuredAt: '2026-10-01',
          weightKg: null as unknown as number,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('modification : effacer le seul poids → 400 ; effacer la taille vide → accepté', async () => {
      await expect(
        service.update('a1', 'm1', 'u1', {
          weightKg: null as unknown as number,
        }),
      ).rejects.toThrow(BadRequestException);
      await service.update('a1', 'm1', 'u1', {
        heightCm: null as unknown as number,
      });
      expect(prisma.animalMeasurement.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { heightCm: null },
      });
    });
  });
});
