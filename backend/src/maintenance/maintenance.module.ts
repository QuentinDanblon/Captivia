import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

/**
 * Maintenance planifiée (W2-08) : purge quotidienne des données techniques arrivées en fin de
 * conservation. Le planificateur (`ScheduleModule.forRoot()`) est enregistré par NotificationsModule.
 */
@Module({
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
