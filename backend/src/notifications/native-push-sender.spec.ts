import { Logger } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';
import { FetchLike, GOOGLE_OAUTH_TOKEN_URL } from './fcm-client';
import {
  ANDROID_CHANNEL_ID,
  CONFIG_ERROR_LOG_INTERVAL_MS,
  MAX_TITLE_LENGTH,
  NATIVE_PUSH_KIND,
  NativePushSender,
  buildFcmMessage,
  coveredLocally,
} from './native-push-sender';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const ENV = {
  FCM_SERVICE_ACCOUNT_JSON: Buffer.from(
    JSON.stringify({
      type: 'service_account',
      project_id: 'captivia-app',
      client_email: 'fcm@captivia-app.iam.gserviceaccount.com',
      private_key: privateKey,
    }),
  ).toString('base64'),
};
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);

type Device = {
  id: string;
  token: string;
  platform: string;
  localRemindersUntil: Date | null;
  localRemindersAsOf?: Date | null;
};

function prismaWith(devices: Device[]) {
  const prisma = {
    deviceToken: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          devices.map((d) => ({ localRemindersAsOf: null, ...d })),
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, service: prisma as unknown as PrismaService };
}

/** FCM simulé : réponse choisie selon le jeton visé. */
function fcm(byToken: Record<string, { status: number; body?: unknown }>) {
  const sent: Array<{ message: Record<string, unknown> }> = [];
  const impl: FetchLike = jest.fn((url, init) => {
    if (url === GOOGLE_OAUTH_TOKEN_URL) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: 'at', expires_in: 3600 }),
      });
    }
    const body = JSON.parse(init.body) as { message: Record<string, unknown> };
    sent.push(body);
    const res = byToken[body.message.token as string] ?? { status: 200 };
    return Promise.resolve({
      ok: res.status === 200,
      status: res.status,
      json: () => Promise.resolve(res.body ?? {}),
    });
  });
  return { impl, sent };
}

const unregistered = {
  status: 404,
  body: {
    error: {
      status: 'NOT_FOUND',
      details: [
        {
          '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
          errorCode: 'UNREGISTERED',
        },
      ],
    },
  },
};

const payload = {
  title: 'Nourrissage',
  body: 'Kaa',
  data: { eventId: 'ev-1', type: 'Nourrissage', animalId: 'a-1', locale: 'fr' },
};

describe('NativePushSender', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sans configuration : désactivé, journal info, aucune requête', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { prisma, service } = prismaWith([]);
    const { impl } = fcm({});
    const sender = new NativePushSender(service, { env: {}, fetch: impl });

    expect(sender.enabled).toBe(false);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('push natif (Android / iOS) désactivé'),
    );
    expect(error).not.toHaveBeenCalled();
    await expect(sender.deliver('u1', payload)).resolves.toEqual({
      sent: 0,
      failed: 0,
      removed: 0,
      covered: 0,
    });
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
    expect(impl).not.toHaveBeenCalled();
  });

  it('configuration invalide : désactivé avec un journal d’erreur (sans la clé)', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const sender = new NativePushSender(prismaWith([]).service, {
      env: { FCM_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}' },
    });
    expect(sender.enabled).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Configuration FCM invalide'),
    );
  });

  it('envoie à chaque appareil du compte ; purge les jetons refusés', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { prisma, service } = prismaWith([
      {
        id: 'd1',
        token: 'tok-ok',
        platform: 'android',
        localRemindersUntil: null,
      },
      {
        id: 'd2',
        token: 'tok-gone',
        platform: 'ios',
        localRemindersUntil: null,
      },
      {
        id: 'd3',
        token: 'tok-busy',
        platform: 'android',
        localRemindersUntil: null,
      },
    ]);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { impl, sent } = fcm({
      'tok-gone': unregistered,
      'tok-busy': { status: 503, body: { error: { status: 'UNAVAILABLE' } } },
    });
    const sender = new NativePushSender(service, {
      env: ENV,
      fetch: impl,
      now: () => NOW,
    });

    const res = await sender.deliver('u1', payload);
    expect(res).toEqual({ sent: 1, failed: 1, removed: 1, covered: 0 });
    expect(sent.map((s) => s.message.token).sort()).toEqual([
      'tok-busy',
      'tok-gone',
      'tok-ok',
    ]);
    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    // Seul le jeton UNREGISTERED est supprimé ; l'échec transitoire le conserve.
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { id: 'd2' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    // Le jeton n'apparaît jamais dans les journaux.
    expect(JSON.stringify(warn.mock.calls)).not.toContain('tok-busy');
  });

  it('anti-doublon : un rappel déjà programmé en local sur l’appareil ne lui est pas envoyé', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const at = new Date(NOW + 60_000);
    const asOf = new Date(NOW - 3_600_000);
    const { service } = prismaWith([
      // Rappels programmés jusqu'à dans 30 jours, source inchangée depuis : couvert.
      {
        id: 'd1',
        token: 'tok-local',
        platform: 'ios',
        localRemindersUntil: new Date(NOW + 30 * 86_400_000),
        localRemindersAsOf: asOf,
      },
      // Couverture qui s'arrête avant le soin (limite des 64 rappels) : push envoyé.
      {
        id: 'd2',
        token: 'tok-short',
        platform: 'android',
        localRemindersUntil: new Date(NOW),
        localRemindersAsOf: asOf,
      },
      // Rappels locaux coupés / inconnus : push envoyé.
      {
        id: 'd3',
        token: 'tok-none',
        platform: 'android',
        localRemindersUntil: null,
      },
      // Couverture sans état des soins connu : push envoyé.
      {
        id: 'd4',
        token: 'tok-nostate',
        platform: 'android',
        localRemindersUntil: new Date(NOW + 30 * 86_400_000),
        localRemindersAsOf: null,
      },
    ]);
    const { impl, sent } = fcm({});
    const sender = new NativePushSender(service, {
      env: ENV,
      fetch: impl,
      now: () => NOW,
    });

    const localReminder = { at, sourceUpdatedAt: new Date(asOf.getTime()) };
    const res = await sender.deliver('u1', { ...payload, localReminder });
    expect(res).toEqual({ sent: 3, failed: 0, removed: 0, covered: 1 });
    expect(sent.map((s) => s.message.token).sort()).toEqual([
      'tok-none',
      'tok-nostate',
      'tok-short',
    ]);

    // Routine modifiée (site web) APRÈS la dernière synchronisation de l'app : push envoyé.
    sent.length = 0;
    const stale = await sender.deliver('u1', {
      ...payload,
      localReminder: { at, sourceUpdatedAt: new Date(asOf.getTime() + 1) },
    });
    expect(stale).toEqual({ sent: 4, failed: 0, removed: 0, covered: 0 });

    // Sans `localReminder` (RDV, vaccin, type personnalisé, test) : tous les appareils.
    sent.length = 0;
    expect((await sender.deliver('u1', payload)).sent).toBe(4);
  });

  it('jeton d’accès refusé : un seul journal d’erreur, rien n’est purgé', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { prisma, service } = prismaWith([
      { id: 'd1', token: 'a', platform: 'android', localRemindersUntil: null },
      { id: 'd2', token: 'b', platform: 'android', localRemindersUntil: null },
    ]);
    const impl: FetchLike = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      }),
    );
    const sender = new NativePushSender(service, { env: ENV, fetch: impl });
    expect(await sender.deliver('u1', payload)).toEqual({
      sent: 0,
      failed: 2,
      removed: 0,
      covered: 0,
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
  });

  it('SENDER_ID_MISMATCH : erreur de configuration, aucun jeton purgé, journal limité à 1/min', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const mismatch = {
      status: 403,
      body: {
        error: {
          status: 'PERMISSION_DENIED',
          details: [
            {
              '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
              errorCode: 'SENDER_ID_MISMATCH',
            },
          ],
        },
      },
    };
    const { prisma, service } = prismaWith([
      { id: 'd1', token: 'a', platform: 'android', localRemindersUntil: null },
      { id: 'd2', token: 'b', platform: 'ios', localRemindersUntil: null },
    ]);
    const { impl } = fcm({ a: mismatch, b: mismatch });
    let clock = NOW;
    const sender = new NativePushSender(service, {
      env: ENV,
      fetch: impl,
      now: () => clock,
    });

    expect(await sender.deliver('u1', payload)).toEqual({
      sent: 0,
      failed: 2,
      removed: 0,
      covered: 0,
    });
    await sender.deliver('u1', payload);
    expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('SENDER_ID_MISMATCH');

    clock += CONFIG_ERROR_LOG_INTERVAL_MS;
    await sender.deliver('u1', payload);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('jeton d’accès indisponible : coupe-circuit 60 s (aucun appel à Google) et journal limité à 1/min', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service } = prismaWith([
      { id: 'd1', token: 'a', platform: 'android', localRemindersUntil: null },
    ]);
    const impl: FetchLike = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'backend_error' }),
      }),
    );
    let clock = NOW;
    const sender = new NativePushSender(service, {
      env: ENV,
      fetch: impl,
      now: () => clock,
    });

    expect((await sender.deliver('u1', payload)).failed).toBe(1);
    expect(impl).toHaveBeenCalledTimes(1);
    clock += 30_000;
    expect((await sender.deliver('u1', payload)).failed).toBe(1);
    // Échec immédiat pendant le coupe-circuit : Google n'est pas rappelé.
    expect(impl).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);

    clock += 30_000;
    await sender.deliver('u1', payload);
    expect(impl).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('échéance de l’exécution dépassée : canal natif sauté, sans requête', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { prisma, service } = prismaWith([
      { id: 'd1', token: 'a', platform: 'android', localRemindersUntil: null },
    ]);
    const { impl } = fcm({});
    const sender = new NativePushSender(service, {
      env: ENV,
      fetch: impl,
      now: () => NOW,
    });
    expect(
      await sender.deliver('u1', { ...payload, nativeDeadline: NOW }),
    ).toEqual({ sent: 0, failed: 0, removed: 0, covered: 0 });
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
    expect(impl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('échéance atteinte pendant un envoi lent : abandonné et compté en échec, sans attendre FCM', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service } = prismaWith([
      { id: 'd1', token: 'ok', platform: 'android', localRemindersUntil: null },
      { id: 'd2', token: 'slow', platform: 'ios', localRemindersUntil: null },
    ]);
    const impl: FetchLike = (url, init) => {
      if (url === GOOGLE_OAUTH_TOKEN_URL) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access_token: 'at', expires_in: 3600 }),
        });
      }
      const { message } = JSON.parse(init.body) as {
        message: { token: string };
      };
      if (message.token === 'slow') return new Promise(() => undefined);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    };
    const sender = new NativePushSender(service, {
      env: ENV,
      fetch: impl,
      now: () => NOW,
    });
    const started = Date.now();
    const res = await sender.deliver('u1', {
      ...payload,
      nativeDeadline: NOW + 50,
    });
    expect(res).toEqual({ sent: 1, failed: 1, removed: 0, covered: 0 });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('aucun appareil : aucune requête', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { impl } = fcm({});
    const sender = new NativePushSender(prismaWith([]).service, {
      env: ENV,
      fetch: impl,
    });
    expect((await sender.deliver('u1', payload)).sent).toBe(0);
    expect(impl).not.toHaveBeenCalled();
  });
});

describe('buildFcmMessage', () => {
  it('notification affichée par le système, data en chaînes, options Android et APNs', () => {
    const msg = buildFcmMessage(
      { token: 'tok', platform: 'ios' },
      { ...payload, data: { ...payload.data, animalId: null, extra: 3 } },
      NOW,
    );
    expect(msg).toEqual({
      token: 'tok',
      notification: { title: 'Nourrissage', body: 'Kaa' },
      data: {
        eventId: 'ev-1',
        type: 'Nourrissage',
        locale: 'fr',
        extra: '3',
        kind: NATIVE_PUSH_KIND,
      },
      android: {
        ttl: '3600s',
        priority: 'high',
        collapse_key: 'ev-1',
        notification: {
          channel_id: ANDROID_CHANNEL_ID,
          icon: 'ic_stat_captivia',
          color: '#0aa678',
          sound: 'default',
          tag: 'ev-1',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(NOW / 1000 + 3600),
          'apns-collapse-id': 'ev-1',
        },
        payload: { aps: { sound: 'default' } },
      },
    });
  });

  it('borne les textes et respecte TTL 0 / urgence basse', () => {
    const msg = buildFcmMessage(
      { token: 't', platform: 'android' },
      { title: 'x'.repeat(500), body: 'y', ttlSeconds: 0, urgency: 'low' },
      NOW,
    );
    expect(msg.notification?.title).toHaveLength(MAX_TITLE_LENGTH);
    expect(msg.android?.priority).toBe('normal');
    expect(msg.android?.ttl).toBe('0s');
    expect(msg.apns?.headers).toEqual({
      'apns-priority': '5',
      'apns-expiration': '0',
    });
    expect(msg.data).toEqual({ kind: NATIVE_PUSH_KIND });
  });
});

describe('coveredLocally', () => {
  const at = new Date(NOW);
  const asOf = new Date(NOW - 1000);
  const localReminder = { at, sourceUpdatedAt: asOf };
  const device = (until: Date | null, state: Date | null = asOf) => ({
    localRemindersUntil: until,
    localRemindersAsOf: state,
  });
  it('vrai seulement si le soin précède la fin de la couverture et que la source n’a pas changé depuis', () => {
    expect(
      coveredLocally(device(new Date(NOW + 1)), { ...payload, localReminder }),
    ).toBe(true);
    expect(
      coveredLocally(device(new Date(NOW)), { ...payload, localReminder }),
    ).toBe(false);
    expect(coveredLocally(device(null), { ...payload, localReminder })).toBe(
      false,
    );
    expect(
      coveredLocally(device(new Date(NOW + 1), null), {
        ...payload,
        localReminder,
      }),
    ).toBe(false);
    expect(
      coveredLocally(device(new Date(NOW + 1), new Date(NOW - 1001)), {
        ...payload,
        localReminder,
      }),
    ).toBe(false);
    expect(coveredLocally(device(new Date(NOW + 1)), payload)).toBe(false);
  });
});
