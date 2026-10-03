import { Module } from '@nestjs/common';
import {
  GbifApiException,
  GbifRateLimitException,
  GbifNotFoundException,
  GbifTimeoutException,
  GbifServiceUnavailableException,
  GbifInvalidResponseException,
} from './custom-exceptions';

@Module({
  providers: [
    GbifApiException,
    GbifRateLimitException,
    GbifNotFoundException,
    GbifTimeoutException,
    GbifServiceUnavailableException,
    GbifInvalidResponseException,
  ],
  exports: [
    GbifApiException,
    GbifRateLimitException,
    GbifNotFoundException,
    GbifTimeoutException,
    GbifServiceUnavailableException,
    GbifInvalidResponseException,
  ],
})
export class ExceptionsModule {}
