import { Module } from '@nestjs/common';
import { ApiGatewayService } from './api-gateway.service';
import { ApiGatewayController } from './api-gateway.controller';
import { WikipediaModule } from '../external/wikipedia/wikipedia.module';
import { WikidataModule } from '../external/wikidata/wikidata.module';
import { ExternalModule } from '../external/external.module';
import { CacheModule } from '../cache/cache.module';
import { TransformerModule } from '../transformers/transformer.module';
import { FilterModule } from '../filters/filter.module';

@Module({
  imports: [
    WikipediaModule,
    WikidataModule,
    ExternalModule,
    CacheModule,
    TransformerModule,
    FilterModule,
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
  exports: [ApiGatewayService],
})
export class GatewayModule {}
