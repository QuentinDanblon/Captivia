import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

// bcryptjs 2.x est livré sans types : on type localement la seule fonction utilisée.
const bcrypt = bcryptjs as unknown as {
  compare(plain: string, hash: string): Promise<boolean>;
};

/**
 * Version du format d'export (à incrémenter si la structure change).
 * v2 : emailVerifiedAt, sessions, état du flux calendrier, nombre d'abonnements push actifs.
 */
export const EXPORT_FORMAT_VERSION = 2;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suppression définitive du compte (RGPD art. 17).
   *
   * Le mot de passe est re-vérifié par bcrypt. Toutes les relations de User sont en
   * `onDelete: Cascade` dans schema.prisma (Animal -> Routine, ActionLog,
   * AnimalHealthRecord, Medication, VetAppointment, AnimalMeasurement, Vaccination,
   * BreedingRecord ; PushSubscription, NotificationPreference, NotificationEvent,
   * PasswordResetToken). Les suppressions explicites ci-dessous, dans la même
   * transaction, rendent l'opération indépendante de ces cascades (défense en
   * profondeur) et atomique : tout ou rien.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    await this.prisma.$transaction(async (tx) => {
      const animalFilter = { animal: { userId } };
      await tx.notificationEvent.deleteMany({ where: { userId } });
      await tx.routine.deleteMany({ where: animalFilter });
      await tx.actionLog.deleteMany({ where: animalFilter });
      await tx.animalHealthRecord.deleteMany({ where: animalFilter });
      await tx.medication.deleteMany({ where: animalFilter });
      await tx.vetAppointment.deleteMany({ where: animalFilter });
      await tx.animalMeasurement.deleteMany({ where: animalFilter });
      await tx.vaccination.deleteMany({ where: animalFilter });
      await tx.breedingRecord.deleteMany({ where: animalFilter });
      await tx.animal.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    // Pas d'e-mail dans les logs : donnée personnelle.
    this.logger.log(`Compte supprimé (userId=${userId})`);
  }

  /**
   * Export complet des données de l'utilisateur (RGPD art. 20), gratuit pour tous.
   * Exclut passwordHash, tokens de réinitialisation, empreintes des refresh tokens, jeton du flux
   * calendrier (seul son état actif / inactif est exporté) et clés cryptographiques push.
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        locale: true,
        role: true,
        isPremium: true,
        termsAcceptedAt: true,
        termsVersion: true,
        emailVerifiedAt: true,
        timezone: true,
        // Jamais le jeton (même haché) : seulement l'état du flux, dérivé ci-dessous.
        calendarToken: true,
        points: true,
        grade: true,
        createdAt: true,
        updatedAt: true,
        animals: {
          orderBy: { createdAt: 'asc' },
          include: {
            routines: true,
            history: true,
            healthRecords: true,
            medications: true,
            vetAppointments: true,
            measurements: true,
            vaccinations: true,
            breedingRecords: true,
          },
        },
        notificationPreferences: true,
        notificationEvents: { orderBy: { scheduledAt: 'asc' } },
        pushSubscriptions: {
          // `keys` (p256dh/auth) sont des secrets techniques, non exportés.
          select: { id: true, endpoint: true, createdAt: true },
        },
        // Sessions (refresh tokens) : métadonnées seulement, JAMAIS l'empreinte du jeton.
        refreshTokens: {
          orderBy: { createdAt: 'asc' },
          select: {
            userAgent: true,
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    const {
      animals,
      notificationPreferences,
      notificationEvents,
      pushSubscriptions,
      refreshTokens,
      calendarToken,
      points,
      grade,
      ...profile
    } = user;

    return {
      exportVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      gamification: { points, grade },
      sessions: refreshTokens,
      calendarFeed: { enabled: calendarToken !== null },
      pushSubscriptionsActive: pushSubscriptions.length,
      animals: animals.map(({ history, ...animal }) => ({
        ...animal,
        actionLogs: history,
      })),
      notificationPreferences,
      notificationEvents,
      pushSubscriptions,
    };
  }
}
