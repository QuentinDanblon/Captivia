import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HANDLE_HOLD_DAYS, CommunityErrorCode } from './community.constants';
import { conflict } from './community.errors';

const DAY_MS = 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Réservation des pseudos libérés (anti-usurpation) : un pseudo abandonné (changement de pseudo,
 * départ de la communauté, suppression du compte) reste réservé HANDLE_HOLD_DAYS jours à son
 * ancien titulaire, qui peut le reprendre ; personne d'autre ne le peut avant l'expiration.
 */
export async function holdHandle(
  db: Db,
  handleKey: string,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const expiresAt = new Date(now.getTime() + HANDLE_HOLD_DAYS * DAY_MS);
  await db.communityHandleHold.upsert({
    where: { handleKey },
    create: { handleKey, userId, releasedAt: now, expiresAt },
    update: { userId, releasedAt: now, expiresAt },
  });
}

/**
 * Prise d'un pseudo : 409 HANDLE_TAKEN s'il est réservé à un autre compte ; sinon la réservation
 * (la sienne, ou une réservation expirée) est levée.
 */
export async function claimHandle(
  db: Db,
  handleKey: string,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const hold = await db.communityHandleHold.findUnique({
    where: { handleKey },
    select: { userId: true, expiresAt: true },
  });
  if (!hold) return;
  if (hold.userId !== userId && hold.expiresAt.getTime() > now.getTime()) {
    throw conflict(
      CommunityErrorCode.HANDLE_TAKEN,
      'This handle is already taken.',
    );
  }
  await db.communityHandleHold.deleteMany({ where: { handleKey } });
}
