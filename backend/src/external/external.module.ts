import { Module } from '@nestjs/common';
import { WikipediaModule } from './wikipedia/wikipedia.module';
import { WikidataModule } from './wikidata/wikidata.module';
import { GbifService } from './gbif.service';
import { OpenDataController } from './open-data.controller';
import { OpenDataService } from './open-data.service';
import { ExternalHttpModule } from './http/external-http.module';

@Module({
  imports: [ExternalHttpModule, WikipediaModule, WikidataModule],
  controllers: [OpenDataController],
  providers: [GbifService, OpenDataService],
  exports: [WikipediaModule, WikidataModule, GbifService, OpenDataService],
})
export class ExternalModule {}