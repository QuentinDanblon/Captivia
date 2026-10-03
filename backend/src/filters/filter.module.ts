import { Module } from '@nestjs/common';
import { SpeciesFilterService } from './species-filter.service';
import { TransformerModule } from '../transformers/transformer.module';

@Module({
  imports: [TransformerModule],
  providers: [SpeciesFilterService],
  exports: [SpeciesFilterService],
})
export class FilterModule {}
