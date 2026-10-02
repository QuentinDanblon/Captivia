import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';

/** LOG_LEVEL accepte les niveaux Nest historiques (log, verbose, info) et pino. */
const LEVEL_MAP: Record<string, string> = {
  error: 'error',
  warn: 'warn',
  log: 'info',
  info: 'info',
  debug: 'debug',
  verbose: 'trace',
  trace: 'trace',
};

export function resolvePinoLevel(raw = process.env.LOG_LEVEL): string {
  return LEVEL_MAP[(raw || 'info').toLowerCase()] ?? 'info';
}

/** Reprend un x-request-id entrant raisonnable, sinon génère un UUID ; renvoyé en header. */
export function genReqId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = value && /^[\w.:-]{1,128}$/.test(value) ? value : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}

/**
 * Masque la valeur du paramètre `token` d'une URL (jeton du flux iCalendar « Agenda des soins » :
 * un secret transporté en query string ne doit pas finir dans les logs d'accès).
 */
export function redactTokenInUrl(url: unknown): unknown {
  return typeof url === 'string'
    ? url.replace(/([?&]token=)[^&#]*/gi, '$1[REDACTED]')
    : url;
}

export function buildLoggerParams(): Params {
  const env = process.env.NODE_ENV;
  const production = env === 'production';
  return {
    pinoHttp: {
      level: env === 'test' ? 'silent' : resolvePinoLevel(),
      genReqId,
      serializers: {
        // Reçoit la requête déjà sérialisée par pino-std-serializers (wrapRequestSerializer).
        req: (serialized: Record<string, unknown>) => ({
          ...serialized,
          url: redactTokenInUrl(serialized.url),
          query:
            serialized.query &&
            typeof serialized.query === 'object' &&
            'token' in serialized.query
              ? { ...serialized.query, token: '[REDACTED]' }
              : serialized.query,
        }),
      },
      customProps: (req) => ({
        reqId: (req as IncomingMessage & { id?: string }).id,
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          '*.password',
          '*.token',
          '*.email',
        ],
        censor: '[REDACTED]',
      },
      // Les sondes (orchestrateur, monitoring) ne doivent pas noyer les logs.
      autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/health') },
      ...(production || env === 'test'
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, colorize: true },
            },
          }),
    },
  };
}
