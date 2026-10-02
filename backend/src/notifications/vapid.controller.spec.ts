import { VapidController } from './vapid.controller';
import { WebPushSender } from './push-sender';

describe('VapidController', () => {
  it('returns the VAPID public key when push is configured', () => {
    const controller = new VapidController({
      publicKey: 'BPublicKey',
    } as unknown as WebPushSender);
    expect(controller.getPublicKey()).toEqual({ publicKey: 'BPublicKey' });
  });

  it('returns a null key when push is not configured', () => {
    const controller = new VapidController({
      publicKey: null,
    } as unknown as WebPushSender);
    expect(controller.getPublicKey()).toEqual({ publicKey: null });
  });
});
