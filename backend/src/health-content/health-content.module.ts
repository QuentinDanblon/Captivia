import { Module } from '@nestjs/common';
import {
  HealthContentController,
  PubMedController,
} from './health-content.controller';
import { HealthContentService } from './health-content.service';
import { PubmedService } from './services/pubmed.service';

@Module({
  controllers: [HealthContentController, PubMedController],
  providers: [HealthContentService, PubmedService],
  exports: [HealthContentService],
})
export class HealthContentModule {}
