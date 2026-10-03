import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DEVICE_TOKEN_THROTTLE } from '../config/throttle.config';
import { DeviceTokensController } from './device-tokens.controller';
import type { DeviceTokensService } from './device-tokens.service';

describe('DeviceTokensController', () => {
  it('authentifié (JWT) et limité en débit sur toutes ses routes', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      DeviceTokensController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(
      Reflect.getMetadata('THROTTLER:LIMITdefault', DeviceTokensController),
    ).toBe(DEVICE_TOKEN_THROTTLE.default.limit);
    expect(
      Reflect.getMetadata('THROTTLER:TTLdefault', DeviceTokensController),
    ).toBe(60_000);
  });

  it('délègue au service avec l’identifiant du compte connecté', async () => {
    const service = {
      register: jest.fn().mockResolvedValue({ enabled: true }),
      unregister: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new DeviceTokensController(
      service as unknown as DeviceTokensService,
    );
    const dto = { token: 't'.repeat(40), platform: 'ios' as const };
    await controller.register({ user: { id: 'u1' } }, dto);
    expect(service.register).toHaveBeenCalledWith('u1', dto);
    await controller.unregister({ user: { id: 'u1' } }, { token: dto.token });
    expect(service.unregister).toHaveBeenCalledWith('u1', dto.token);
  });
});
