import { Module } from '@nestjs/common';
import { ErrorInterceptor } from './error.interceptor';

@Module({
  providers: [ErrorInterceptor],
  exports: [ErrorInterceptor],
})
export class InterceptorsModule {}
