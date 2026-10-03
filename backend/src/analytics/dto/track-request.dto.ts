import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/**
 * Query de `POST /analytics/track` (W2-08, LEG-06).
 *
 * Aucun `userId` : un identifiant en query finit dans les journaux d'accès (proxy, Render,
 * Sentry). L'utilisateur est déduit du JWT ; toute propriété inconnue, dont `userId`, est
 * refusée (400) par la ValidationPipe globale (`forbidNonWhitelisted`).
 */
export class TrackRequestQueryDto {
  @ApiProperty({
    example: '/species/search',
    description: 'Chemin de la route mesurée',
  })
  @IsString()
  @MaxLength(200)
  @Matches(/^\/[A-Za-z0-9/_\-.:]*$/, {
    message: 'endpoint doit être un chemin commençant par « / »',
  })
  endpoint!: string;

  @ApiProperty({ example: 120, description: 'Durée de la requête (ms)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600_000)
  duration!: number;
}
