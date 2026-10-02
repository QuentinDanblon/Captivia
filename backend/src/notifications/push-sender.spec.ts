import * as webPush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PUSH_TTL_SECONDS, WebPushSender } from './push-sender';
import { DEFAULT_VAPID_SUBJECT, readVapidConfig } from './vapid.config';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const sendNotification = webPush.sendNotification as jest.Mock;
const setVapidDetails = webPush.setVapidDetails as jest.Mock;

const KEYS = { publicKey: 'pub-key', privateKey: 'priv-key' };

const sub = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  userId: 'u1',
  endpoint: `https://push.example.com/${id}`,
  keys: { p256dh: `p256dh-${id}`, auth: `auth-${id}` },
  ...extra,
});

const pushError = (statusCode: number) =>
  Object.assign(new Error(`push ${statusCode}`), { statusCode });

describe('readVapidConfig', () => {
  it('returns null when a key is missing or blank', () => {
    expect(readVapidConfig({})).toBeNull();
    expect(readVapidConfig({ VAPID_PUBLIC_KEY: 'a' })).toBeNull();
    expect(
      readVapidConfig({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: '  ' }),
    ).toBeNull();
  });

  it('defaults the subject and trims values', () => {
    expect(
      readVapidConfig({ VAPID_PUBLIC_KEY: ' a ', VAPID_PRIVATE_KEY: ' b ' }),
    ).toEqual({
      publicKey: 'a',
      privateKey: 'b',
      subject: DEFAULT_VAPID_SUBJECT,
    });
    expect(
      readVapidConfig({
        VAPID_PUBLIC_KEY: 'a',
        VAPID_PRIVATE_KEY: 'b',
        VAPID_SUBJECT: 'mailto:ops@example.com',
      })?.subject,
    ).toBe('mailto:ops@example.com');
  });
});

describe('WebPushSender', () => {
  const findMany = jest.fn();
  const deleteMany = jest.fn();
  const prisma = {
    pushSubscription: { findMany, deleteMany },
  } as unknown as PrismaService;
  const ENV_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
  const saved: Record<string, string | undefined> = {};

  const withKeys = () => {
    process.env.VAPID_PUBLIC_KEY = KEYS.publicKey;
    process.env.VAPID_PRIVATE_KEY = KEYS.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:test@captivia.test';
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    deleteMany.mockResolvedValue({ count: 1 });
    sendNotification.mockResolvedValue({ statusCode: 201 });
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe('without VAPID keys', () => {
    it('is a no-op: no DB read, no push, returns false', async () => {
      const sender = new WebPushSender(prisma);

      expect(sender.enabled).toBe(false);
      expect(sender.publicKey).toBeNull();
      await expect(
        sender.sendToUser('u1', { title: 'T', body: 'B' }),
      ).resolves.toBe(false);
      expect(findMany).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
      expect(setVapidDetails).not.toHaveBeenCalled();
    });

    it('deliver reports zero everywhere', async () => {
      const sender = new WebPushSender(prisma);
      await expect(
        sender.deliver('u1', { title: 'T', body: 'B' }),
      ).resolves.toEqual({ sent: 0, failed: 0, removed: 0 });
    });
  });

  describe('with invalid VAPID keys', () => {
    it('disables push instead of crashing at startup', async () => {
      withKeys();
      setVapidDetails.mockImplementationOnce(() => {
        throw new Error('Vapid public key must be a URL safe Base 64');
      });
      const sender = new WebPushSender(prisma);

      expect(sender.enabled).toBe(false);
      expect(sender.publicKey).toBeNull();
      await expect(
        sender.sendToUser('u1', { title: 'T', body: 'B' }),
      ).resolves.toBe(false);
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('with VAPID keys', () => {
    it('exposes the public key and validates the VAPID details at startup', () => {
      withKeys();
      const sender = new WebPushSender(prisma);

      expect(sender.enabled).toBe(true);
      expect(sender.publicKey).toBe(KEYS.publicKey);
      expect(setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@captivia.test',
        KEYS.publicKey,
        KEYS.privateKey,
      );
    });

    it('sends to every subscription of the user with TTL, urgency and payload', async () => {
      withKeys();
      findMany.mockResolvedValue([sub('a'), sub('b')]);
      const sender = new WebPushSender(prisma);

      const ok = await sender.sendToUser('u1', {
        title: 'Nourrir Rex',
        body: 'Rex',
        data: { animalId: 'an1', locale: 'fr' },
      });

      expect(ok).toBe(true);
      expect(findMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(sendNotification).toHaveBeenCalledTimes(2);
      const [pushSub, body, options] = sendNotification.mock.calls[0];
      expect(pushSub).toEqual({
        endpoint: 'https://push.example.com/a',
        keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
      });
      expect(JSON.parse(body)).toMatchObject({
        title: 'Nourrir Rex',
        body: 'Rex',
        data: { animalId: 'an1', locale: 'fr' },
      });
      expect(options).toMatchObject({
        TTL: DEFAULT_PUSH_TTL_SECONDS,
        urgency: 'normal',
        vapidDetails: {
          subject: 'mailto:test@captivia.test',
          publicKey: KEYS.publicKey,
          privateKey: KEYS.privateKey,
        },
      });
      expect(options.timeout).toBeGreaterThan(0);
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it('honours a custom TTL and urgency', async () => {
      withKeys();
      findMany.mockResolvedValue([sub('a')]);
      const sender = new WebPushSender(prisma);

      await sender.sendToUser('u1', {
        title: 'T',
        body: 'B',
        ttlSeconds: 120.9,
        urgency: 'high',
      });

      expect(sendNotification.mock.calls[0][2]).toMatchObject({
        TTL: 120,
        urgency: 'high',
      });
    });

    it('returns false when the user has no subscription', async () => {
      withKeys();
      findMany.mockResolvedValue([]);
      const sender = new WebPushSender(prisma);

      await expect(
        sender.sendToUser('u1', { title: 'T', body: 'B' }),
      ).resolves.toBe(false);
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it.each([404, 410])(
      'deletes the subscription on a %i response',
      async (status) => {
        withKeys();
        findMany.mockResolvedValue([sub('gone')]);
        sendNotification.mockRejectedValueOnce(pushError(status));
        const sender = new WebPushSender(prisma);

        const res = await sender.deliver('u1', { title: 'T', body: 'B' });

        expect(res).toEqual({ sent: 0, failed: 0, removed: 1 });
        expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'gone' } });
      },
    );

    it('sendToUser is false when the only subscription is gone', async () => {
      withKeys();
      findMany.mockResolvedValue([sub('gone')]);
      sendNotification.mockRejectedValueOnce(pushError(410));
      const sender = new WebPushSender(prisma);

      await expect(
        sender.sendToUser('u1', { title: 'T', body: 'B' }),
      ).resolves.toBe(false);
    });

    it('keeps the subscription on a transient error (500) and on network failures', async () => {
      withKeys();
      findMany.mockResolvedValue([sub('a'), sub('b')]);
      sendNotification
        .mockRejectedValueOnce(pushError(500))
        .mockRejectedValueOnce(new Error('ECONNRESET'));
      const sender = new WebPushSender(prisma);

      const res = await sender.deliver('u1', { title: 'T', body: 'B' });

      expect(res).toEqual({ sent: 0, failed: 2, removed: 0 });
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it('succeeds if at least one device is reached, and still purges the gone one', async () => {
      withKeys();
      findMany.mockResolvedValue([sub('ok'), sub('gone')]);
      sendNotification.mockImplementation((s: { endpoint: string }) =>
        s.endpoint.endsWith('/gone')
          ? Promise.reject(pushError(410))
          : Promise.resolve({ statusCode: 201 }),
      );
      const sender = new WebPushSender(prisma);

      const res = await sender.deliver('u1', { title: 'T', body: 'B' });

      expect(res).toEqual({ sent: 1, failed: 0, removed: 1 });
      expect(deleteMany).toHaveBeenCalledTimes(1);
      expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'gone' } });
    });

    it('skips subscriptions with malformed keys without calling web-push', async () => {
      withKeys();
      findMany.mockResolvedValue([
        sub('bad', { keys: { p256dh: 'x' } }),
        sub('null', { keys: null }),
      ]);
      const sender = new WebPushSender(prisma);

      const res = await sender.deliver('u1', { title: 'T', body: 'B' });

      expect(res).toEqual({ sent: 0, failed: 2, removed: 0 });
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('does not fail when the purge itself fails', async () => {
      withKeys();
      findMany.mockResolvedValue([sub('gone')]);
      sendNotification.mockRejectedValueOnce(pushError(410));
      deleteMany.mockRejectedValueOnce(new Error('db down'));
      const sender = new WebPushSender(prisma);

      await expect(
        sender.deliver('u1', { title: 'T', body: 'B' }),
      ).resolves.toEqual({ sent: 0, failed: 0, removed: 1 });
    });
  });
});
