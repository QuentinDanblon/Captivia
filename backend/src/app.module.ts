import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import * as Joi from 'joi';
import { SpeciesModule } from './species/species.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { CacheModule } from './cache/cache.module';
import { TransformerModule } from './transformers/transformer.module';
import { FilterModule } from './filters/filter.module';
import { ExceptionsModule } from './common/exceptions/exceptions.module';
import { InterceptorsModule } from './common/interceptors/interceptors.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DatabaseOptimizationModule } from './database/database-optimization.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthContentModule } from './health-content/health-content.module';
import { LegislationModule } from './legislation/legislation.module';
import { FoodModule } from './food/food.module';
import { EquipmentModule } from './equipment/equipment.module';
import { AnimalsModule } from './animals/animals.module';
import { RoutinesModule } from './routines/routines.module';
import { MedicationsModule } from './medications/medications.module';
import { VetAppointmentsModule } from './vet-appointments/vet-appointments.module';
import { AnimalMeasurementsModule } from './animal-measurements/animal-measurements.module';
import { VaccinationsModule } from './vaccinations/vaccinations.module';
import { BreedingModule } from './breeding/breeding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GradeModule } from './grade/grade.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SpeciesRoutinesModule } from './species-routines/species-routines.module';

const redisEnabled = process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        PORT: Joi.number().default(3001),
        CACHE_TYPE: Joi.string().valid('memory', 'redis', 'memcached').default('memory'),
        REDIS_ENABLED: Joi.string().valid('true', 'false').default('false'),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ...(redisEnabled
      ? [
          RedisModule.forRootAsync({
            useFactory: (config: ConfigService) => {
              const host = config.get('REDIS_HOST', 'localhost');
              const port = config.get('REDIS_PORT', '6379');
              return {
                type: 'single',
                url: `redis://${host}:${port}`,
                options: { lazyConnect: true },
              };
            },
            inject: [ConfigService],
          }),
        ]
      : []),
    PrismaModule,
    AuthModule,
    HealthContentModule,
    LegislationModule,
    FoodModule,
    EquipmentModule,
    AffiliateModule,
    AnimalsModule,
    SubscriptionModule,
    SpeciesRoutinesModule,
    RoutinesModule,
    MedicationsModule,
    VetAppointmentsModule,
    AnimalMeasurementsModule,
    VaccinationsModule,
    BreedingModule,
    NotificationsModule,
    GradeModule,
    CacheModule.registerAsync(),
    TransformerModule,
    FilterModule,
    ExceptionsModule,
    InterceptorsModule,
    SpeciesModule,
    HealthModule,
    CommonModule,
    ...(redisEnabled ? [MonitoringModule, AnalyticsModule, DatabaseOptimizationModule] : []),
  ],
})
export class AppModule {}
