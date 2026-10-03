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
/**
 * Canal Android (créé par l'app, partagé avec les rappels locaux W6-06). « v2 » : visibilité
 * PRIVÉE sur l'écran verrouillé (revue de sécurité, constat 7) ; la visibilité d'un canal existant
 * ne pouvant plus changer, l'app supprime l'ancien canal `captivia-reminders` et crée celui-ci.
 * À garder identique à `REMINDER_CHANNEL_ID` (frontend/src/lib/local-reminders.ts).
 */
export const ANDROID_CHANNEL_ID = 'captivia-reminders-v2';
/** Icône de notification Android (`mobile/android-template/res/drawable-*`). */
export const ANDROID_SMALL_ICON = 'ic_stat_captivia';
export const ANDROID_ICON_COLOR = '#0aa678';
/**
 * Budget du canal natif pour UNE exécution du scheduler (revue de sécurité, constat 5) : au-delà,
 * les envois natifs restants sont sautés pour ce tick (e-mail et Web Push continuent).
 */
export const NATIVE_PUSH_RUN_BUDGET_MS = 60_000;
/** Une même erreur de configuration (clé, projet, APNs) est journalisée au plus une fois par minute. */
export const CONFIG_ERROR_LOG_INTERVAL_MS = 60_000;
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

/**
 * Le rappel est-il déjà programmé en notification locale sur cet appareil ? Seulement si :
 * - le scheduler a établi que l'app programme CE rappel à CET instant (`payload.localReminder`,
 *   cf. `localReminderFor` : routines et médicaments de l'Agenda, jamais RDV ni vaccins) ;
 * - l'instant précède la fin de la couverture déclarée par l'appareil (`localRemindersUntil`) ;
 * - la source (routine, médicament) n'a pas changé depuis l'état des soins que l'appareil a
 *   programmé (`localRemindersAsOf`) : une routine créée ou modifiée ailleurs (site web) alors que
 *   l'app n'a pas resynchronisé n'est pas programmée sur le téléphone.
 */
export function coveredLocally(
  device: Pick<DeviceToken, 'localRemindersUntil' | 'localRemindersAsOf'>,
  payload: PushReminderPayload,
): boolean {
  const ref = payload.localReminder;
  const until = device.localRemindersUntil;
  const asOf = device.localRemindersAsOf;
  if (!ref || !(until instanceof Date) || !(asOf instanceof Date)) return false;
  const at = ref.at.getTime();
  const updated = ref.sourceUpdatedAt.getTime();
  return (
    !Number.isNaN(at) &&
    !Number.isNaN(updated) &&
    at < until.getTime() &&
    updated <= asOf.getTime()
  );
}

/** Attend `work` au plus `ms` : true si le délai a expiré avant. */
async function timedOut(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), Math.max(0, ms));
    timer.unref?.();
  });
  try {
    return await Promise.race([work.then(() => false as const), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Push natif (W6-07) : FCM HTTP v1 pour Android, et pour iOS via le relais APNs de FCM (clé
 * APNs .p8 téléversée dans le projet Firebase). Un seul fournisseur, gratuit, une seule clé côté
 * serveur.
 *
 * Sans `FCM_SERVICE_ACCOUNT_JSON` : canal désactivé (journal « info » au démarrage), `deliver`
 * ne fait rien. Jetons refusés par FCM (UNREGISTERED, INVALID_ARGUMENT visant le jeton) : supprimés
 * aussitôt. Erreurs de configuration (jeton d'accès refusé, SENDER_ID_MISMATCH : clé d'un autre
 * projet Firebase, clé APNs absente) : jetons conservés, journal d'erreur au plus une fois par
 * minute.
 *
 * Échéance : avec `payload.nativeDeadline` (posée par le scheduler, {@link NATIVE_PUSH_RUN_BUDGET_MS}
 * par exécution), rien n'est tenté après l'échéance et un envoi en cours est abandonné (compté en
 * échec) quand elle tombe : FCM ou Google lents ne retiennent jamais le job de rappels.
 */
@Injectable()
export class NativePushSender {
  private readonly logger = new Logger(NativePushSender.name);
  private readonly client: FcmClient | null;
  private readonly now: () => number;
  /** Dernier journal par erreur de configuration (limite : une fois par minute). */
  private readonly lastConfigLog = new Map<string, number>();

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
    const deadline = payload.nativeDeadline;
    if (deadline !== undefined && this.now() >= deadline) {
      this.logRateLimited(
        'DEADLINE',
        `Budget du push natif épuisé pour cette exécution (${NATIVE_PUSH_RUN_BUDGET_MS / 1000} s) : envois natifs sautés jusqu'au prochain passage.`,
        'warn',
      );
      return result;
    }

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: {
        id: true,
        token: true,
        platform: true,
        localRemindersUntil: true,
        localRemindersAsOf: true,
      },
    });
    if (devices.length === 0) return result;

    const nowMs = this.now();
    const inFlight = new Set<string>();
    const work = Promise.all(
      devices.map(async (device) => {
        if (coveredLocally(device, payload)) {
          result.covered = (result.covered ?? 0) + 1;
          return;
        }
        inFlight.add(device.id);
        try {
          await this.sendOne(client, device, payload, nowMs, result);
        } finally {
          inFlight.delete(device.id);
        }
      }),
    );
    if (deadline === undefined) {
      await work;
      return result;
    }
    if (!(await timedOut(work, deadline - this.now()))) return result;
    // Échéance atteinte : les envois encore en vol sont comptés en échec (ils se terminent en
    // arrière-plan, bornés par leur propre délai ; le bilan rendu n'en dépend plus).
    this.logRateLimited(
      'DEADLINE',
      `Budget du push natif épuisé pour cette exécution (${NATIVE_PUSH_RUN_BUDGET_MS / 1000} s) : envois natifs en cours abandonnés.`,
      'warn',
    );
    return { ...result, failed: result.failed + inFlight.size };
  }

  private async sendOne(
    client: FcmClient,
    device: Pick<DeviceToken, 'id' | 'token' | 'platform'>,
    payload: PushReminderPayload,
    nowMs: number,
    result: PushDeliveryResult,
  ): Promise<void> {
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
    switch (res.errorCode) {
      case 'AUTH':
        this.logRateLimited('AUTH', `Push natif indisponible : ${res.message}`);
        return;
      case 'SENDER_ID_MISMATCH':
        this.logRateLimited(
          'SENDER_ID_MISMATCH',
          "Push natif refusé par FCM (SENDER_ID_MISMATCH) : la clé FCM_SERVICE_ACCOUNT_JSON n'appartient pas au projet Firebase de l'app (google-services.json / GoogleService-Info.plist). Jetons conservés ; voir RUNBOOK § 4.7.",
        );
        return;
      case 'THIRD_PARTY_AUTH_ERROR':
        this.logRateLimited(
          'THIRD_PARTY_AUTH_ERROR',
          'Push iOS refusé par APNs (clé APNs du projet Firebase absente ou invalide).',
        );
        return;
      default:
        this.logger.warn(
          `Push natif vers ${device.id} (${device.platform}) en échec (${res.status || 'réseau'} ${res.errorCode ?? ''}) : ${res.message}`,
        );
    }
  }

  /** Journal d'une erreur de configuration, au plus une fois par minute et par type. */
  private logRateLimited(
    key: string,
    message: string,
    level: 'error' | 'warn' = 'error',
  ): void {
    const now = this.now();
    const last = this.lastConfigLog.get(key);
    if (last !== undefined && now - last < CONFIG_ERROR_LOG_INTERVAL_MS) return;
    this.lastConfigLog.set(key, now);
    this.logger[level](message);
  }
}
