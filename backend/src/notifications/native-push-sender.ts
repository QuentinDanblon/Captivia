import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { DeviceToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FcmClient, FcmMessage, FetchLike } from './fcm-client';
import { readFcmConfig } from './fcm.config';
import {
  DEFAULT_PUSH_TTL_SECONDS,
  PushDeliveryResult,
  PushReminderPayload,
  emptyDelivery,
} from './push-sender';

/** Options d'injection (tests) : environnement et transport HTTP. */
export interface NativePushOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: FetchLike;
  now?: () => number;
}
export const NATIVE_PUSH_OPTIONS = Symbol('NATIVE_PUSH_OPTIONS');

/** Marque des notifications distantes Captivia (champ `data.kind`, lu par l'app au toucher). */
export const NATIVE_PUSH_KIND = 'captivia-push';
/** Canal Android (créé par l'app, partagé avec les rappels locaux W6-06). */
export const ANDROID_CHANNEL_ID = 'captivia-reminders';
/** Icône de notification Android (`mobile/android-template/res/drawable-*`). */
export const ANDROID_SMALL_ICON = 'ic_stat_captivia';
export const ANDROID_ICON_COLOR = '#0aa678';
/** Bornes des textes (le message FCM complet est limité à 4 Ko). */
export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 400;

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/** `data` FCM : uniquement des chaînes non vides (contrainte de l'API). */
function stringData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 0) out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value))
      out[key] = String(value);
  }
  return out;
}

/**
 * Message FCM v1 d'une notification Captivia (fonction pure, testée) : bloc `notification`
 * affiché par le système (app fermée comprise), `data` pour le lien au toucher, options Android
 * (canal, icône, durée de vie, priorité) et APNs (expiration, priorité, regroupement).
 */
export function buildFcmMessage(
  device: Pick<DeviceToken, 'token' | 'platform'>,
  payload: PushReminderPayload,
  nowMs: number,
): FcmMessage {
  const ttl = Math.max(
    0,
    Math.floor(payload.ttlSeconds ?? DEFAULT_PUSH_TTL_SECONDS),
  );
  const urgent =
    (payload.urgency ?? 'normal') !== 'very-low' &&
    (payload.urgency ?? 'normal') !== 'low';
  const eventId =
    typeof payload.data?.eventId === 'string' && payload.data.eventId
      ? payload.data.eventId.slice(0, 64)
      : undefined;

  return {
    token: device.token,
    notification: {
      title: truncate(payload.title, MAX_TITLE_LENGTH),
      body: truncate(payload.body, MAX_BODY_LENGTH),
    },
    data: stringData({ ...(payload.data ?? {}), kind: NATIVE_PUSH_KIND }),
    android: {
      ttl: `${ttl}s`,
      priority: urgent ? 'high' : 'normal',
      ...(eventId ? { collapse_key: eventId } : {}),
      notification: {
        channel_id: ANDROID_CHANNEL_ID,
        icon: ANDROID_SMALL_ICON,
        color: ANDROID_ICON_COLOR,
        sound: 'default',
        // Un même rappel renvoyé (nouvel essai) remplace la notification au lieu de s'ajouter.
        ...(eventId ? { tag: eventId } : {}),
      },
    },
    apns: {
      headers: {
        'apns-priority': urgent ? '10' : '5',
        // 0 = une seule tentative ; sinon instant (secondes) au-delà duquel APNs abandonne.
        'apns-expiration':
          ttl === 0 ? '0' : String(Math.floor(nowMs / 1000) + ttl),
        ...(eventId ? { 'apns-collapse-id': eventId } : {}),
      },
      payload: { aps: { sound: 'default' } },
    },
  };
}

/** Le rappel est-il déjà programmé en notification locale sur cet appareil ? */
export function coveredLocally(
  device: Pick<DeviceToken, 'localRemindersUntil'>,
  payload: PushReminderPayload,
): boolean {
  const at = payload.localReminderAt;
  const until = device.localRemindersUntil;
  return (
    at instanceof Date &&
    until instanceof Date &&
    !Number.isNaN(at.getTime()) &&
    at.getTime() < until.getTime()
  );
}

/**
 * Push natif (W6-07) : FCM HTTP v1 pour Android, et pour iOS via le relais APNs de FCM (clé
 * APNs .p8 téléversée dans le projet Firebase). Un seul fournisseur, gratuit, une seule clé côté
 * serveur.
 *
 * Sans `FCM_SERVICE_ACCOUNT_JSON` : canal désactivé (journal « info » au démarrage), `deliver`
 * ne fait rien. Jetons refusés par FCM (UNREGISTERED, SENDER_ID_MISMATCH, INVALID_ARGUMENT visant
 * le jeton) : supprimés aussitôt.
 */
@Injectable()
export class NativePushSender {
  private readonly logger = new Logger(NativePushSender.name);
  private readonly client: FcmClient | null;
  private readonly now: () => number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(NATIVE_PUSH_OPTIONS)
    options: NativePushOptions | null = null,
  ) {
    this.now = options?.now ?? Date.now;
    const result = readFcmConfig(options?.env ?? process.env);
    if (!result.config) {
      if (result.reason === 'absent') {
        this.logger.log(
          'FCM_SERVICE_ACCOUNT_JSON absente : push natif (Android / iOS) désactivé.',
        );
      } else {
        this.logger.error(
          `Configuration FCM invalide, push natif désactivé : ${result.detail ?? 'inconnue'}.`,
        );
      }
      this.client = null;
      return;
    }
    this.client = new FcmClient(result.config, options?.fetch, this.now);
    this.logger.log(
      `Push natif actif (FCM HTTP v1, projet ${result.config.projectId}).`,
    );
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async deliver(
    userId: string,
    payload: PushReminderPayload,
  ): Promise<PushDeliveryResult> {
    const result = emptyDelivery();
    if (!this.client) return result;
    const client = this.client;

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: {
        id: true,
        token: true,
        platform: true,
        localRemindersUntil: true,
      },
    });
    if (devices.length === 0) return result;

    const nowMs = this.now();
    let authFailureLogged = false;
    await Promise.all(
      devices.map(async (device) => {
        if (coveredLocally(device, payload)) {
          result.covered = (result.covered ?? 0) + 1;
          return;
        }
        const res = await client.send(buildFcmMessage(device, payload, nowMs));
        if (res.ok) {
          result.sent++;
          return;
        }
        if (res.invalidToken) {
          await this.prisma.deviceToken
            .deleteMany({ where: { id: device.id } })
            .catch((e: unknown) =>
              this.logger.warn(
                `Purge du jeton natif ${device.id} impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
              ),
            );
          result.removed++;
          return;
        }
        result.failed++;
        if (res.errorCode === 'AUTH') {
          if (!authFailureLogged) {
            authFailureLogged = true;
            this.logger.error(`Push natif indisponible : ${res.message}`);
          }
          return;
        }
        if (res.errorCode === 'THIRD_PARTY_AUTH_ERROR') {
          this.logger.error(
            `Push iOS refusé par APNs (clé APNs du projet Firebase absente ou invalide) : jeton ${device.id}.`,
          );
          return;
        }
        this.logger.warn(
          `Push natif vers ${device.id} (${device.platform}) en échec (${res.status || 'réseau'} ${res.errorCode ?? ''}) : ${res.message}`,
        );
      }),
    );
    return result;
  }
}
