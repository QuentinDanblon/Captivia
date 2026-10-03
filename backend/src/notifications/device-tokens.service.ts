import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NativePushSender } from './native-push-sender';
import { RegisterDeviceTokenDto } from './dto/device-token.dto';

/** Installations de l'app par compte : au-delà, la moins récemment vue est remplacée. */
export const MAX_DEVICE_TOKENS_PER_USER = 10;
/**
 * Couverture locale maximale acceptée : l'app programme 30 jours de rappels (W6-06). Une date
 * plus lointaine (horloge du téléphone fausse, client bogué) est ramenée à 31 jours, pour qu'un
 * appareil ne puisse jamais se soustraire durablement aux rappels distants.
 */
export const MAX_LOCAL_COVERAGE_MS = 31 * 24 * 60 * 60 * 1000;

export interface DeviceTokenRegistration {
  /** Le push natif est configuré côté serveur (FCM) : l'appareil recevra des notifications. */
  enabled: boolean;
  platform: string;
  lastSeenAt: Date;
}

const isUniqueViolation = (e: unknown) =>
  (e as { code?: string } | null)?.code === 'P2002';

/**
 * Jetons de push natif (W6-07). Un jeton FCM désigne une installation de l'app : il appartient au
 * DERNIER compte qui l'enregistre (l'appareil a changé de main, ou la déconnexion n'a pas pu
 * joindre le serveur). Le jeton est un secret technique : jamais renvoyé ni journalisé.
 */
@Injectable()
export class DeviceTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nativePush: NativePushSender,
  ) {}

  async register(
    userId: string,
    dto: RegisterDeviceTokenDto,
    now: Date = new Date(),
  ): Promise<DeviceTokenRegistration> {
    // `localRemindersUntil` absent : couverture inchangée (synchronisation locale hors ligne) ;
    // null : plus aucun rappel local programmé.
    const coverage =
      dto.localRemindersUntil === undefined
        ? undefined
        : this.coverage(dto.localRemindersUntil, dto.localRemindersAsOf, now);
    const data = {
      userId,
      platform: dto.platform,
      locale: dto.locale ?? 'fr',
      lastSeenAt: now,
      ...(coverage ?? {}),
    };
    /** Ligne reprise d'un autre compte : la couverture locale de l'ancien compte ne vaut plus. */
    const transferred = {
      localRemindersUntil: null,
      localRemindersAsOf: null,
      ...data,
    };

    const upsert = async (tx: Prisma.TransactionClient) => {
      // Verrou User : le plafond d'installations tient sous enregistrements concurrents.
      await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (dto.previousToken && dto.previousToken !== dto.token) {
        await tx.deviceToken.deleteMany({
          where: { userId, token: dto.previousToken },
        });
      }
      const existing = await tx.deviceToken.findUnique({
        where: { token: dto.token },
        select: { id: true, userId: true },
      });
      if (existing && existing.userId === userId) {
        return tx.deviceToken.update({ where: { id: existing.id }, data });
      }
      // Nouvelle installation du compte, ou jeton repris d'un autre compte (revue de sécurité,
      // constat 6) : dans les deux cas le compte gagne une ligne, le plafond s'applique (les
      // moins récemment vues partent ; la ligne transférée n'est pas encore au compte).
      const current = await tx.deviceToken.findMany({
        where: { userId },
        orderBy: [{ lastSeenAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const excess = current.length - (MAX_DEVICE_TOKENS_PER_USER - 1);
      if (excess > 0) {
        await tx.deviceToken.deleteMany({
          where: { id: { in: current.slice(0, excess).map((c) => c.id) } },
        });
      }
      if (existing) {
        return tx.deviceToken.update({
          where: { id: existing.id },
          data: transferred,
        });
      }
      return tx.deviceToken.create({ data: { ...data, token: dto.token } });
    };

    let row: { platform: string; lastSeenAt: Date };
    try {
      row = await this.prisma.$transaction(upsert);
    } catch (e) {
      // Création concurrente du même jeton : la ligne existe désormais. On rejoue tout
      // (suppression de `previousToken`, transfert avec couverture remise à zéro, plafond).
      if (!isUniqueViolation(e)) throw e;
      row = await this.prisma.$transaction(upsert);
    }
    return {
      enabled: this.nativePush.enabled,
      platform: row.platform,
      lastSeenAt: row.lastSeenAt,
    };
  }

  /** Retire le jeton du compte (déconnexion, rappels coupés sur l'appareil). Idempotent. */
  async unregister(userId: string, token: string): Promise<{ success: true }> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { success: true };
  }

  /**
   * Couverture locale déclarée. Elle n'est retenue qu'avec l'état des soins qui l'a produite
   * (`localRemindersAsOf`, instant serveur de l'Agenda, ramené à `now` au plus) : sans lui, on ne
   * peut pas savoir quelles routines / quels médicaments l'appareil a programmés → aucune.
   */
  private coverage(
    until: string | null,
    asOf: string | undefined,
    now: Date,
  ): {
    localRemindersUntil: Date | null;
    localRemindersAsOf: Date | null;
  } {
    const none = { localRemindersUntil: null, localRemindersAsOf: null };
    const at = until ? new Date(until) : null;
    const state = asOf ? new Date(asOf) : null;
    if (!at || Number.isNaN(at.getTime())) return none;
    if (!state || Number.isNaN(state.getTime())) return none;
    const max = now.getTime() + MAX_LOCAL_COVERAGE_MS;
    return {
      localRemindersUntil: at.getTime() > max ? new Date(max) : at,
      localRemindersAsOf:
        state.getTime() > now.getTime() ? new Date(now.getTime()) : state,
    };
  }
}
