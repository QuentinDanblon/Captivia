import { Module } from '@nestjs/common';
import { AnimalsController } from './animals.controller';
import { AnimalsService } from './animals.service';
import { AnimalHealthController } from './animal-health.controller';
import { AnimalHealthService } from './animal-health.service';
import { PublicAnimalController } from './public-animal.controller';
import { CarnetExportController } from './carnet-export.controller';
import { CarnetExportService } from './carnet-export.service';

@Module({
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
