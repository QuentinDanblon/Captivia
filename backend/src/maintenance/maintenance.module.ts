import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CommunityModule } from '../community/community.module';

/**
 * Maintenance planifiée (W2-08) : purge quotidienne des données techniques arrivées en fin de
 * conservation. Le planificateur (`ScheduleModule.forRoot()`) est enregistré par NotificationsModule.
 */
@Module({
  // Purge des médias communautaires orphelins (fichiers compris).
  imports: [CommunityModule],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
