import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from './animals.service';

/** Slugifie un nom pour le nom de fichier d'export (ex. "Rango" → "rango"). */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || 'animal';
}

/**
 * Export du carnet de santé complet d'un animal (JSON).
 * Pas de PDF pour l'instant : le frontend pourra imprimer ce JSON (documenté
 * dans le module). Format : { exportedAt, animal, sections: {...} }.
 */
@Injectable()
export class CarnetExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
  ) {}

  async exportCarnet(animalId: string, userId: string) {
    // Vérifie l'existence + l'ownership (404 / 403)
    const animal = await this.animalsService.findOne(animalId, userId);

    const [
      healthRecords,
      measurements,
      vaccinations,
      medications,
      vetAppointments,
      routines,
      actionLogs,
    ] = await Promise.all([
      this.prisma.animalHealthRecord.findMany({
        where: { animalId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.animalMeasurement.findMany({
        where: { animalId },
        orderBy: { measuredAt: 'desc' },
      }),
      this.prisma.vaccination.findMany({
        where: { animalId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.medication.findMany({
        where: { animalId },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.vetAppointment.findMany({
        where: { animalId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.routine.findMany({
        where: { animalId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.actionLog.findMany({
        where: { animalId },
        orderBy: { doneAt: 'desc' },
        take: 100, // historique limité à 100 entrées
      }),
    ]);

    const slug = animal.publicSlug ?? slugify(animal.name);
    return {
      filename: `carnet-${slug}.json`,
      payload: {
        exportedAt: new Date().toISOString(),
        animal,
        sections: {
          healthRecords,
          measurements,
          vaccinations,
          medications,
          vetAppointments,
          routines,
          actionLogs,
        },
      },
    };
  }
}
