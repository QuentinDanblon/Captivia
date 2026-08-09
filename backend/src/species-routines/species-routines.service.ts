import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureAnimalOwnership } from '../common/helpers/ownership.helper';

@Injectable()
export class SpeciesRoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Modèles de routines par défaut proposés pour l'espèce d'un animal
   * (utilisés à la création d'un animal / dans la modale d'ajout de routine).
   * Accessible à tous les utilisateurs (pas de gate premium) :
   * ce sont des suggestions génériques, pas un rappel actif.
   */
  async findTemplatesForAnimal(userId: string, animalId: string) {
    const animal = await ensureAnimalOwnership(this.prisma, animalId, userId);

    return this.prisma.speciesRoutineTemplate.findMany({
      where: { speciesId: animal.speciesId, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
