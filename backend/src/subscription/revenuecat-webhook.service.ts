import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  SubscriptionEnvironment,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Sous-ensemble utile d'un événement webhook RevenueCat (api_version 1.0). */
export interface RevenueCatEvent {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  aliases?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
  product_id?: unknown;
  entitlement_ids?: unknown;
  store?: unknown;
  environment?: unknown;
  original_transaction_id?: unknown;
  transaction_id?: unknown;
  expiration_at_ms?: unknown;
  grace_period_expiration_at_ms?: unknown;
  event_timestamp_ms?: unknown;
  cancel_reason?: unknown;
}

export type WebhookOutcome =
  | 'applied'
  | 'duplicate'
  | 'ignored_stale'
  | 'ignored_unknown_user'
  | 'ignored_entitlement'
  | 'ignored_store'
  | 'ignored_type'
  | 'ignored_invalid';

const PROVIDER = 'revenuecat';

/** Types qui (ré)ouvrent l'accès. */
const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);
/** cancel_reason qui signifient un remboursement : accès retiré immédiatement. */
const REFUND_REASONS = new Set(['CUSTOMER_SUPPORT', 'REFUND']);

/** Compare deux secrets en temps constant (hachage préalable : longueurs égales, pas de fuite de longueur). */
export function safeSecretEqual(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b) && provided.length === expected.length;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
function ms(v: unknown): Date | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? new Date(n)
    : null;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

function sourceFromStore(store: string | null): SubscriptionSource | null {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return SubscriptionSource.APPLE;
    case 'PLAY_STORE':
      return SubscriptionSource.GOOGLE;
    case 'PROMOTIONAL':
      return SubscriptionSource.MANUAL;
    default:
      return null; // STRIPE, AMAZON, RC_BILLING… : non vendus par Captivia
  }
}

/**
 * Applique les notifications RevenueCat sur `Subscription` (W6-08).
 * - idempotence : PaymentEvent.eventId UNIQUE (un rejeu renvoie « duplicate ») ;
 * - ordre : un événement plus ancien que le dernier appliqué (event_timestamp_ms) est ignoré ;
 * - app_user_id = User.id Captivia (configuré côté app via Purchases.logIn / appUserID).
 */
@Injectable()
export class RevenueCatWebhookService {
  private readonly logger = new Logger(RevenueCatWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  entitlementId(): string {
    return (process.env.REVENUECAT_ENTITLEMENT_ID || '').trim() || 'premium';
  }

  async handle(event: RevenueCatEvent): Promise<WebhookOutcome> {
    const eventId = str(event.id);
    const type = str(event.type);
    if (!eventId || !type) {
      this.logger.warn('Webhook RevenueCat sans id/type : ignoré');
      return 'ignored_invalid';
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const userId = await this.resolveUserId(tx, event, type);
        // Insertion d'abord : la contrainte UNIQUE garantit l'idempotence même en concurrence.
        const log = await tx.paymentEvent.create({
          data: {
            provider: PROVIDER,
            eventId,
            type,
            userId,
            payload: this.sanitize(event),
          },
          select: { id: true },
        });
        const outcome = await this.apply(tx, event, type, eventId, userId);
        if (outcome !== 'applied') {
          await tx.paymentEvent.update({
            where: { id: log.id },
            data: { outcome },
          });
        }
        return outcome;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        JSON.stringify(e.meta?.target ?? '').includes('eventId')
      ) {
        return 'duplicate';
      }
      throw e;
    }
  }

  /** Payload journalisé sans les attributs d'abonné (peuvent contenir e-mail, nom…). */
  private sanitize(event: RevenueCatEvent): Prisma.InputJsonValue {
    const copy = { ...(event as Record<string, unknown>) };
    delete copy.subscriber_attributes;
    return JSON.parse(JSON.stringify(copy)) as Prisma.InputJsonValue;
  }

  private async resolveUserId(
    tx: Prisma.TransactionClient,
    event: RevenueCatEvent,
    type: string,
  ): Promise<string | null> {
    const candidates =
      type === 'TRANSFER'
        ? strArray(event.transferred_to)
        : [str(event.app_user_id), str(event.original_app_user_id)].filter(
            (x): x is string => x !== null,
          );
    // Les identifiants anonymes RevenueCat ($RCAnonymousID:…) ne sont jamais des comptes Captivia.
    const ids = candidates.filter((c) => !c.startsWith('$RCAnonymousID'));
    if (ids.length === 0) return null;
    const users = await tx.user.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const found = new Set(users.map((u) => u.id));
    return ids.find((id) => found.has(id)) ?? null;
  }

  private async apply(
    tx: Prisma.TransactionClient,
    event: RevenueCatEvent,
    type: string,
    eventId: string,
    userId: string | null,
  ): Promise<WebhookOutcome> {
    if (type === 'TEST') return 'ignored_type';
    if (!userId) {
      this.logger.warn(
        `Webhook RevenueCat ${type} (${eventId}) : aucun utilisateur Captivia correspondant, rien n'est créé`,
      );
      return 'ignored_unknown_user';
    }

    if (type === 'TRANSFER') {
      const from = strArray(event.transferred_from).filter(
        (id) => id !== userId,
      );
      if (from.length > 0) {
        await tx.subscription.updateMany({
          where: { userId: { in: from } },
          data: { userId, lastEventId: eventId },
        });
      }
      return 'applied';
    }

    const entitlements = event.entitlement_ids;
    if (
      Array.isArray(entitlements) &&
      entitlements.length > 0 &&
      !strArray(entitlements).includes(this.entitlementId())
    ) {
      return 'ignored_entitlement';
    }

    const source = sourceFromStore(str(event.store));
    if (!source) return 'ignored_store';

    const productId = str(event.product_id) ?? 'unknown';
    const originalTransactionId =
      str(event.original_transaction_id) ?? str(event.transaction_id);
    if (!originalTransactionId) return 'ignored_invalid';

    const eventAt = ms(event.event_timestamp_ms) ?? new Date();
    const expiration = ms(event.expiration_at_ms);
    const grace = ms(event.grace_period_expiration_at_ms);
    const environment =
      str(event.environment) === 'SANDBOX'
        ? SubscriptionEnvironment.SANDBOX
        : SubscriptionEnvironment.PRODUCTION;

    let status: SubscriptionStatus;
    let willRenew: boolean;
    let currentPeriodEnd: Date | null = expiration;
    if (ACTIVE_TYPES.has(type)) {
      status = SubscriptionStatus.ACTIVE;
      willRenew = type !== 'NON_RENEWING_PURCHASE';
    } else if (type === 'CANCELLATION') {
      const reason = str(event.cancel_reason);
      if (reason && REFUND_REASONS.has(reason)) {
        status = SubscriptionStatus.REFUNDED;
        currentPeriodEnd = eventAt; // accès retiré immédiatement
      } else {
        status = SubscriptionStatus.CANCELLED; // accès conservé jusqu'à l'échéance
      }
      willRenew = false;
    } else if (type === 'BILLING_ISSUE') {
      if (grace && grace.getTime() > Date.now()) {
        status = SubscriptionStatus.IN_GRACE_PERIOD;
        currentPeriodEnd = grace;
        willRenew = true;
      } else {
        status = SubscriptionStatus.BILLING_ISSUE;
        willRenew = false;
      }
    } else if (type === 'EXPIRATION') {
      status = SubscriptionStatus.EXPIRED;
      willRenew = false;
    } else {
      return 'ignored_type'; // SUBSCRIPTION_PAUSED, INVOICE_ISSUANCE…
    }

    const existing = await tx.subscription.findUnique({
      where: {
        source_originalTransactionId: { source, originalTransactionId },
      },
      select: { id: true, lastEventAt: true },
    });
    if (
      existing?.lastEventAt &&
      eventAt.getTime() < existing.lastEventAt.getTime()
    ) {
      this.logger.log(
        `Webhook RevenueCat ${type} (${eventId}) plus ancien que le dernier appliqué : ignoré`,
      );
      return 'ignored_stale';
    }

    const data = {
      userId,
      productId,
      entitlement: this.entitlementId(),
      status,
      currentPeriodEnd,
      willRenew,
      environment,
      lastEventId: eventId,
      lastEventAt: eventAt,
    };
    if (existing) {
      await tx.subscription.update({ where: { id: existing.id }, data });
    } else {
      await tx.subscription.create({
        data: { ...data, source, originalTransactionId },
      });
    }
    return 'applied';
  }
}
