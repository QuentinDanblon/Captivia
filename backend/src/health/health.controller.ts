import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/** Délai maximal accordé au `SELECT 1` de la sonde de disponibilité (ms). */
export const READINESS_DB_TIMEOUT_MS = 2000;

// Les sondes (orchestrateur, monitoring) ne doivent jamais être limitées en débit.
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness : le process répond. N'interroge aucune dépendance. */
  @Get()
  @ApiOperation({ summary: 'Health check endpoint (liveness)' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness : le service peut traiter du trafic (base de données joignable). */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (SELECT 1, timeout 2 s)' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Database unavailable' })
  async ready() {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`database timeout after ${READINESS_DB_TIMEOUT_MS}ms`)),
            READINESS_DB_TIMEOUT_MS,
          );
        }),
      ]);
    } catch {
      // Aucun détail d'infrastructure dans la réponse (message d'erreur Prisma, URL…).
      throw new ServiceUnavailableException({
        statusCode: 503,
        status: 'unavailable',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (timer) clearTimeout(timer);
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
