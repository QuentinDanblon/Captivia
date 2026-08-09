import { Module } from '@nestjs/common';
import { AnimalsModule } from '../animals/animals.module';
import { BreedingController } from './breeding.controller';
import { BreedingService } from './breeding.service';

@Module({
  imports: [AnimalsModule],
  controllers: [BreedingController],
  providers: [BreedingService],
})
export class BreedingModule {}
