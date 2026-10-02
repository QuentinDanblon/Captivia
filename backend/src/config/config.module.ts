import { Module, Global } from '@nestjs/common';
import { ApiConfigService } from './api.config';

@Global()
@Module({
  providers: [ApiConfigService],
  exports: [ApiConfigService],
})
export class ConfigModule {}
