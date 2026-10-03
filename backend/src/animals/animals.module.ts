import { Module } from '@nestjs/common';
import { AnimalsController } from './animals.controller';
import { AnimalsService } from './animals.service';
import { AnimalHealthController } from './animal-health.controller';
import { AnimalHealthService } from './animal-health.service';
import { PublicAnimalController } from './public-animal.controller';
import { CarnetExportController } from './carnet-export.controller';
import { CarnetExportService } from './carnet-export.service';
import { SpeciesModule } from '../species/species.module';

@Module({
  // Fiche espèce garantie avant la création / le changement d'espèce d'un animal (audit 5).
  imports: [SpeciesModule],
  controllers: [
    AnimalsController,
    AnimalHealthController,
    PublicAnimalController,
    CarnetExportController,
  ],
  providers: [AnimalsService, AnimalHealthService, CarnetExportService],
  exports: [AnimalsService],
})
export class AnimalsModule {}
