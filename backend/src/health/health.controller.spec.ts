import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController, READINESS_DB_TIMEOUT_MS } from './health.controller';

describe('HealthController', () => {
  let app: INestApplication;
  const queryRaw = jest.fn();

  beforeEach(async () => {
    queryRaw.mockReset();
    const moduleRef = await Test.createTestingModule({
      // Throttler très strict (1 req/min) : prouve que /health n'est jamais limité.
      imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 1 }] })],
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('GET /health : liveness inchangé, sans toucher à la base', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('GET /health/ready : 200 quand la base répond', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('GET /health/ready : 503 quand la base est injoignable (sans fuite du message d\'erreur)', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED postgres://user:secret@db:5432'));
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('GET /health/ready : 503 quand la base ne répond pas dans les 2 s', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    queryRaw.mockReturnValue(new Promise(() => undefined)); // ne se résout jamais

    const controller = app.get(HealthController);
    const pending = controller.ready();
    const assertion = expect(pending).rejects.toMatchObject({ status: 503 });
    await jest.advanceTimersByTimeAsync(READINESS_DB_TIMEOUT_MS + 1);
    await assertion;
    expect(READINESS_DB_TIMEOUT_MS).toBe(2000);
  });

  it('les sondes ne sont pas soumises au rate limiting', async () => {
    queryRaw.mockResolvedValue([1]);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/health/ready').expect(200);
    }
  });
});
