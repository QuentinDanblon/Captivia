import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  RateLimiterRedis,
  RateLimiterMemory,
  RateLimiterRes,
} from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { Request, Response } from 'express';

/** Same consume result shape for Redis and Memory limiters */
interface RateLimitResult {
  consumedPoints: number;
  remainingPoints: number;
  msBeforeNext: number;
}

/**
 * Rate limiter using Redis for distributed rate limiting (only when REDIS_ENABLED=true)
 */
class RedisRateLimiter {
  private limiter: RateLimiterRedis;

  constructor(points: number, duration: number) {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    });

    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rate-limit',
      points,
      duration,
    });
  }

  async consume(ip: string, points = 1): Promise<RateLimitResult> {
    return this.limiter.consume(ip, points);
  }
}

/**
 * In-memory rate limiter (used when REDIS_ENABLED is not true)
 */
class MemoryRateLimiter {
  private limiter: RateLimiterMemory;

  constructor(points: number, duration: number) {
    this.limiter = new RateLimiterMemory({
      keyPrefix: 'rate-limit',
      points,
      duration,
    });
  }

  async consume(ip: string, points = 1): Promise<RateLimitResult> {
    return this.limiter.consume(ip, points);
  }
}

/**
 * Base rate limiting guard with IP-based tracking.
 * Uses Redis when REDIS_ENABLED=true, otherwise in-memory (no Redis connection).
 */
abstract class BaseRateLimitGuard implements CanActivate {
  private readonly logger = new Logger('RateLimitGuard');
  private readonly rateLimiter: RedisRateLimiter | MemoryRateLimiter;

  protected constructor(
    protected readonly points: number,
    protected readonly duration: number,
  ) {
    this.rateLimiter =
      process.env.REDIS_ENABLED === 'true'
        ? new RedisRateLimiter(points, duration)
        : new MemoryRateLimiter(points, duration);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const ip = this.getClientIp(request);

    try {
      // Consume rate limit tokens
      const result = await this.rateLimiter.consume(ip);

      // Add rate limit headers
      response.setHeader('X-RateLimit-Limit', String(this.points));
      response.setHeader(
        'X-RateLimit-Remaining',
        String(result.remainingPoints),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((Date.now() + result.msBeforeNext) / 1000).toString(),
      );

      return true;
    } catch (error) {
      // Dépassement de limite : renvoyer une vraie 429 avec Retry-After
      // (au lieu de laisser l'erreur brute du limiter remonter en 500).
      const msBeforeNext =
        error instanceof RateLimiterRes
          ? error.msBeforeNext
          : this.duration * 1000;
      const retryAfter = Math.max(1, Math.ceil(msBeforeNext / 1000));

      this.logger.warn(
        `Rate limit exceeded for IP ${ip} (${this.points}/${this.duration}s) — Retry-After: ${retryAfter}s`,
      );

      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Trop de requêtes. Veuillez réessayer plus tard.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Get client IP from request.
   *
   * Utilise request.ip, qui respecte le réglage Express 'trust proxy' défini dans main.ts :
   *  - sans proxy : adresse socket directe (remoteAddress) ;
   *  - derrière un proxy de confiance (TRUST_PROXY=true) : Express extrait la vraie IP client
   *    depuis X-Forwarded-For (entrée la plus à droite, ajoutée par le proxy — non spoofable).
   * On ne lit JAMAIS directement le header X-Forwarded-For fourni par le client :
   * un attaquant pourrait le forger pour contourner la limite.
   */
  private getClientIp(request: Request): string {
    const ip =
      request.ip ||
      request.socket?.remoteAddress ||
      request.connection?.remoteAddress;
    return ip || 'unknown';
  }
}

/**
 * Rate limiting par défaut : 100 requêtes / 60 s par IP.
 */
@Injectable()
export class RateLimitGuard extends BaseRateLimitGuard {
  constructor() {
    super(100, 60);
  }
}

/**
 * Rate limiting strict pour les routes sensibles (auth : login, register, forgot-password) :
 * 10 requêtes / 60 s par IP.
 */
@Injectable()
export class AuthRateLimitGuard extends BaseRateLimitGuard {
  constructor() {
    super(10, 60);
  }
}
