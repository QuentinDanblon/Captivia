import { Global, Module } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';

/** Global : tout module métier peut injecter EntitlementService sans import explicite. */
@Global()
@Module({
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementModule {}
