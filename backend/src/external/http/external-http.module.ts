import { Global, Module } from '@nestjs/common';
import { ExternalHttpService } from './external-http.service';

/**
 * Client HTTP sortant partagé (une seule instance pour toute l'application, donc un
 * seul jeu de disjoncteurs par fournisseur). Global : injectable partout.
 */
@Global()
@Module({
  providers: [ExternalHttpService],
  exports: [ExternalHttpService],
})
export class ExternalHttpModule {}
