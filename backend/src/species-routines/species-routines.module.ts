import { Module } from '@nestjs/common';
import { SpeciesRoutinesController } from './species-routines.controller';
import { SpeciesRoutinesService } from './species-routines.service';

@Module({
  controllers: [SpeciesRoutinesController],
  providers: [SpeciesRoutinesService],
  exports: [SpeciesRoutinesService],
})
export class SpeciesRoutinesModule {}
