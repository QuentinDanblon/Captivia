import { Test } from '@nestjs/testing';
import { CacheModule } from '../src/cache/cache.module';
import { ExternalModule } from '../src/external/external.module';
import { SpeciesModule } from '../src/species/species.module';

export async function createTestModule() {
  const module = await Test.createTestingModule({
    imports: [CacheModule, ExternalModule, SpeciesModule],
  }).compile();

  return module;
}