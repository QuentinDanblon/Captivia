import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { AdminSubscriptionController } from './admin-subscription.controller';
import { SubscriptionService } from './subscription.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Module({
  controllers: [
    SubscriptionController,
    AdminSubscriptionController,
    RevenueCatWebhookController,
  ],
  providers: [SubscriptionService, RevenueCatWebhookService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
