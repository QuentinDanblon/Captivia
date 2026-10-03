import { BadRequestException } from '@nestjs/common';
import { MedicationsService } from './medications.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnimalsService } from '../animals/animals.service';

/** Date de fin d'un traitement : jamais avant la date de début (même règle que les vaccins). */
describe('MedicationsService — dates', () => {
  const existing = {
    id: 'med-1',
    animalId: 'a1',
    startDate: new Date('2026-10-01T00:00:00Z'),
    endDate: null,
  };
  const prisma = {
    medication: {
      create: jest.fn().mockResolvedValue({ id: 'med-1' }),
      update: jest.fn().mockResolvedValue({ id: 'med-1' }),
      findFirst: jest.fn().mockResolvedValue(existing),
    },
  };
  const animals = { findOne: jest.fn().mockResolvedValue({ id: 'a1' }) };
  const service = new MedicationsService(
    prisma as unknown as PrismaService,
    animals as unknown as AnimalsService,
  );
  const base = {
    name: 'Métacam',
    dose: '0,5',
    frequency: 'daily' as const,
    startDate: '2026-10-05',
  };

  beforeEach(() => jest.clearAllMocks());

  it('création : fin avant début → 400, rien n’est enregistré', async () => {
    await expect(
      service.create('a1', 'u1', { ...base, endDate: '2026-10-04' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.medication.create).not.toHaveBeenCalled();
  });

  it('création : fin le jour du début → acceptée', async () => {
    await service.create('a1', 'u1', { ...base, endDate: '2026-10-05' });
    expect(prisma.medication.create).toHaveBeenCalled();
  });

  it('modification : fin avant le début enregistré → 400', async () => {
    await expect(
      service.update('a1', 'med-1', 'u1', { endDate: '2026-09-30' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.medication.update).not.toHaveBeenCalled();
  });

  it('modification sans date (arrêt du traitement) : jamais bloquée', async () => {
    prisma.medication.findFirst.mockResolvedValueOnce({
      ...existing,
      endDate: new Date('2026-09-01T00:00:00Z'),
    });
    await service.update('a1', 'med-1', 'u1', { active: false });
    expect(prisma.medication.update).toHaveBeenCalled();
  });
});
