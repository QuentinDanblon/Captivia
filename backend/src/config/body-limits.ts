import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Taille maximale d'un corps JSON. Les photos d'animal sont envoyées en data URL dans le JSON
 * (2 Mo décodés au plus, cf. `IsPhotoSource`), soit ~2,7 Mo en base64 : la limite par défaut
 * d'Express (100 Ko) les refusait toutes. 3 Mo couvrent une photo maximale et le reste du corps.
 */
export const JSON_BODY_LIMIT = '3mb';

/**
 * À appeler avant `app.init()` / `app.listen()` (main.ts et tests e2e) : remplace l'analyseur
 * JSON par défaut de Nest par un analyseur à la limite ci-dessus.
 */
export function applyBodyLimits(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
}
