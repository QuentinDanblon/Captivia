/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks axios/supertest typés any */
import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(url = '/animals?token=secret') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method: 'GET', url, originalUrl: url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('logge une exception non-HTTP avec sa stack, sans la renvoyer au client', () => {
    const { host, status, json } = buildHost();
    const error = new Error('db exploded');

    new HttpExceptionFilter().catch(error, host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message, stack] = errorSpy.mock.calls[0];
    expect(message).toContain('GET /animals -> 500: db exploded');
    expect(message).not.toContain('secret'); // la query string n'est pas journalisée
    expect(stack).toBe(error.stack);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('db exploded');
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('logge les HttpException >= 500', () => {
    const { host, status } = buildHost('/health/ready');
    new HttpExceptionFilter().catch(new ServiceUnavailableException(), host);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(503);

    errorSpy.mockClear();
    new HttpExceptionFilter().catch(
      new InternalServerErrorException('oops'),
      buildHost().host,
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('ne logge pas les erreurs client (4xx) et conserve le format de réponse', () => {
    const { host, status, json } = buildHost('/animals/1');
    new HttpExceptionFilter().catch(
      new NotFoundException('Animal not found'),
      host,
    );
    new HttpExceptionFilter().catch(
      new BadRequestException('bad'),
      buildHost().host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Animal not found',
        path: '/animals/1',
      }),
    );
  });

  it("gère une valeur levée qui n'est pas une Error", () => {
    const { host, status } = buildHost();
    new HttpExceptionFilter().catch('just a string', host);
    expect(status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('just a string'),
      undefined,
    );
  });
});
