import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import type { Response } from 'supertest';

/**
 * Serveur HTTP sous-jacent d'une application Nest, typé pour supertest.
 * `INestApplication#getHttpServer()` est typé `any` : le passer tel quel à
 * `request(...)` déclenche `no-unsafe-argument`.
 */
export function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

/**
 * Corps d'une réponse supertest typé par l'appelant. `Response#body` est `any` :
 * `bodyOf<{ id: string }>(res).id` remplace `res.body.id` sans propager de `any`.
 * Le type est une déclaration du test (comme un `as`), pas une validation.
 */
export function bodyOf<T>(res: Pick<Response, 'body'>): T {
  return res.body as T;
}

/** Corps d'erreur HTTP de l'API (HttpExceptionFilter). */
export interface ErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  [key: string]: unknown;
}

/** Ressource créée / lue dont le test ne consulte que l'identifiant. */
export interface IdBody {
  id: string;
}

/** Réponse dont le test ne consulte que l'URL (média, lien…). */
export interface UrlBody {
  url: string;
}

/** Contenu communautaire (publication) : champs consultés par les tests. */
export interface CommunityPostBody {
  id: string;
  type: string;
  media: { id: string; url: string }[];
  speciesCategory?: string;
  animal?: unknown;
}

/** Page de résultats paginée (`{ items, nextCursor }`). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Réponse d'authentification (register / login / refresh). */
export interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; [key: string]: unknown };
  [key: string]: unknown;
}
