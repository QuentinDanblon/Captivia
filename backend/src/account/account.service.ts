import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityDataService } from '../community/community-data.service';

// bcryptjs 2.x est livré sans types : on type localement la seule fonction utilisée.
const bcrypt = bcryptjs as unknown as {
  compare(plain: string, hash: string): Promise<boolean>;
};

/**
 * Version du format d'export (à incrémenter si la structure change).
 * v2 : emailVerifiedAt, sessions, état du flux calendrier, nombre d'abonnements push actifs.
 * v3 : profile.isGuest et profile.lastActiveAt (mode invité ; `email` vaut null pour un invité).
 * v4 : section `community` (profil public, publications, commentaires, réactions, signalements
 *      émis, blocages, décisions de modération, images).
 *      Ajout rétrocompatible (W6-07) : section `appInstallations` (installations de l'app inscrites
 *      au push natif — plateforme, langue, dates ; jamais le jeton FCM). Les lecteurs v4 l'ignorent.
 */
export const EXPORT_FORMAT_VERSION = 4;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly community: CommunityDataService,
  ) {}

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
   *
   * Communauté : profil, publications, commentaires, réactions, signalements émis et blocages sont
   * supprimés dans la même transaction ; les fichiers des images sont effacés juste après (un
   * échec est repris par le job de maintenance, la ligne restant orpheline). Le journal de
   * modération est conservé sans lien vers le compte (subjectId → NULL).
   */
  async deleteAccount(
    userId: string,
    password: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, isGuest: true },
    });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    // Compte invité : aucun mot de passe à re-vérifier, l'access token suffit.
    if (!user.isGuest) {
      const valid =
        typeof password === 'string' &&
        user.passwordHash !== null &&
        (await bcrypt.compare(password, user.passwordHash));
      if (!valid) {
        throw new UnauthorizedException('Mot de passe incorrect');
      }
    }

    const mediaKeys = await this.community.mediaKeysOf(userId);
    await this.prisma.$transaction(async (tx) => {
      await this.community.deleteRows(tx, userId, true);
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
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    await this.community.purgeMedia(mediaKeys);

    // Pas d'e-mail dans les logs : donnée personnelle.
    this.logger.log(`Compte supprimé (userId=${userId})`);
  }

  /**
   * Export complet des données de l'utilisateur (RGPD art. 20), gratuit pour tous.
   * Exclut passwordHash, tokens de réinitialisation, empreintes des refresh tokens, jeton du flux
   * calendrier (seul son état actif / inactif est exporté), clés cryptographiques push et jetons
   * FCM des installations de l'app.
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isGuest: true,
        lastActiveAt: true,
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
        // W6-07 : installations de l'app (le jeton FCM, secret technique, n'est pas exporté).
        deviceTokens: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            platform: true,
            locale: true,
            createdAt: true,
            lastSeenAt: true,
          },
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
      deviceTokens,
      refreshTokens,
      calendarToken,
      points,
      grade,
      ...profile
    } = user;

    const community = await this.community.exportFor(userId);

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
      appInstallations: deviceTokens,
      community,
    };
  }
}
