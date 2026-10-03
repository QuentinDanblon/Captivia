import { Logger } from '@nestjs/common';
import { PushDispatcher } from './push-dispatcher';
import type { NativePushSender } from './native-push-sender';
import type { PushDeliveryResult, WebPushSender } from './push-sender';

const result = (r: Partial<PushDeliveryResult>): PushDeliveryResult => ({
  sent: 0,
  failed: 0,
  removed: 0,
  covered: 0,
  ...r,
});

function build(
  web: () => Promise<PushDeliveryResult>,
  native: () => Promise<PushDeliveryResult>,
) {
  const w = { deliver: jest.fn(web) };
  const n = { deliver: jest.fn(native) };
  return {
    w,
    n,
    dispatcher: new PushDispatcher(
      w as unknown as WebPushSender,
      n as unknown as NativePushSender,
    ),
  };
}

const payload = { title: 'Bain', body: 'Kaa', data: { eventId: 'e1' } };

describe('PushDispatcher', () => {
  afterEach(() => jest.restoreAllMocks());

  it('envoie une fois sur chaque canal et additionne les bilans', async () => {
    const { w, n, dispatcher } = build(
      () => Promise.resolve(result({ sent: 1, removed: 1 })),
      () => Promise.resolve(result({ sent: 2, failed: 1, covered: 1 })),
    );
    await expect(dispatcher.deliver('u1', payload)).resolves.toEqual({
      sent: 3,
      failed: 1,
      removed: 1,
      covered: 1,
    });
    expect(w.deliver).toHaveBeenCalledTimes(1);
    expect(n.deliver).toHaveBeenCalledTimes(1);
    expect(w.deliver).toHaveBeenCalledWith('u1', payload);
    expect(n.deliver).toHaveBeenCalledWith('u1', payload);
  });

  it('un canal qui lève n’empêche pas l’autre', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { dispatcher } = build(
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(result({ sent: 1 })),
    );
    await expect(dispatcher.sendToUser('u1', payload)).resolves.toBe(true);
  });

  it('sendToUser : vrai si un appareil est atteint OU a déjà le rappel en local', async () => {
    const covered = build(
      () => Promise.resolve(result({})),
      () => Promise.resolve(result({ covered: 1 })),
    );
    await expect(covered.dispatcher.sendToUser('u1', payload)).resolves.toBe(
      true,
    );
    const none = build(
      () => Promise.resolve(result({ failed: 1 })),
      () => Promise.resolve(result({})),
    );
    await expect(none.dispatcher.sendToUser('u1', payload)).resolves.toBe(
      false,
    );
  });
});
