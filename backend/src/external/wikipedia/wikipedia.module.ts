import { Module } from '@nestjs/common';
import { WikipediaService } from './wikipedia.service';
import { WikipediaController } from './wikipedia.controller';

@Module({
  controllers: [WikipediaController],
  providers: [WikipediaService],
  exports: [WikipediaService],
})
export class WikipediaModule {}
