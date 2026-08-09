import { Module } from '@nestjs/common';
import { AnimalsModule } from '../animals/animals.module';
import { VetAppointmentsController } from './vet-appointments.controller';
import { VetAppointmentsService } from './vet-appointments.service';

@Module({
  imports: [AnimalsModule],
  controllers: [VetAppointmentsController],
  providers: [VetAppointmentsService],
})
export class VetAppointmentsModule {}
