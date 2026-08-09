import { Module } from '@nestjs/common';
import { AnimalsModule } from '../animals/animals.module';
import { AnimalMeasurementsController } from './animal-measurements.controller';
import { AnimalMeasurementsService } from './animal-measurements.service';

@Module({
  imports: [AnimalsModule],
  controllers: [AnimalMeasurementsController],
  providers: [AnimalMeasurementsService],
})
export class AnimalMeasurementsModule {}
