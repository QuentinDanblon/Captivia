import { Module } from '@nestjs/common';
import { SpeciesTransformerService } from './species-transformer.service';

@Module({
  providers: [SpeciesTransformerService],
  exports: [SpeciesTransformerService],
})
export class TransformerModule {}
