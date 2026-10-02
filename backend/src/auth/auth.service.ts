import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { Prisma, User } from '@prisma/client';
import {
  effectivePremium,
  entitledSubscriptionsSelect,
  hasLegacyOperatorEmailsEnv,
} from '../common/operators';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  BCRYPT_ROUNDS,
  CURRENT_TERMS_VERSION,
  PASSWORD_RESET_TTL_MS,
  normalizeEmail,
} from './auth.constants';

/** Contenu signé des access tokens. */
export interface JwtPayload {
  sub: string;
  email: string;
  /** Copie de User.tokenVersion au moment de l'émission (absent = 0 pour les tokens émis avant W1-01). */
  tokenVersion?: number;
}

/**
 * Hash bcrypt (coût 10) d'une valeur aléatoire jetée : comparé au mot de passe
 * quand l'email est inconnu, pour que le login prenne le même temps que pour
 * un compte existant (anti-énumération par chronométrage).
 */
const DUMMY_PASSWORD_HASH =
  '$2a$10$MBPc/x/JPOw4fhNyVfFZG.3Q6EEtIdZvE1adpXfDvi4lPI.ILPCy.';

const RESET_REQUESTED_MESSAGE =
  'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.';

/** Empreinte stockée en base pour un token de reset (jamais le token en clair). */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit(): void {
    if (hasLegacyOperatorEmailsEnv()) {
      this.logger.warn(
        "OPERATOR_EMAILS / OPERATOR_EMAIL est obsolète et n'accorde plus aucun droit. " +
          'Promouvez les opérateurs avec : npm run operator:set -- <email>',
      );
    }
  }

  async register(registerDto: RegisterDto) {
    const { password, locale } = registerDto;
    // Normalisation défensive (le DTO normalise déjà via @Transform)
    const email = normalizeEmail(registerDto.email);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user (P2002 = email déjà pris en cas de course entre deux
    // inscriptions simultanées : le findUnique ci-dessus ne suffit pas).
    // Le rôle n'est JAMAIS fixé ici : défaut USER (W0-01).
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          locale: locale || 'fr',
          termsAcceptedAt: new Date(),
          termsVersion: CURRENT_TERMS_VERSION,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto) {
    const { password } = loginDto;
    const email = normalizeEmail(loginDto.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { subscriptions: entitledSubscriptionsSelect() },
    });

    // Toujours exécuter un bcrypt.compare (hash factice si compte inconnu) :
    // temps de réponse identique, pas d'énumération des comptes.
    const isPasswordValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Recharge l'utilisateur à chaque requête authentifiée (JwtStrategy).
   * Retourne null si l'utilisateur n'existe plus OU si le token a été émis
   * avant le dernier changement / reset de mot de passe (tokenVersion).
   */
  async validateUser(userId: string, tokenVersion = 0) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Abonnements store non échus (W6-08) : premium calculé sans requête supplémentaire.
      include: { subscriptions: entitledSubscriptionsSelect() },
    });

    if (!user || user.tokenVersion !== tokenVersion) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      locale: user.locale,
      role: user.role,
      isPremium: effectivePremium(user),
    };
  }

  /** Demande de récupération de mot de passe : crée un token et envoie l'email (ou log en dev) */
  async requestPasswordReset(rawEmail: string): Promise<{ message: string }> {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return { message: RESET_REQUESTED_MESSAGE };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.$transaction([
      // Un seul lien actif par compte + purge opportuniste des tokens expirés
      this.prisma.passwordResetToken.deleteMany({
        where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
      }),
    ]);

    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Envoi non bloquant : la réponse (et son temps) ne doit pas révéler
    // l'existence du compte ni l'état du serveur SMTP.
    void this.sendPasswordResetEmail(user.email, user.locale, resetLink);

    return { message: RESET_REQUESTED_MESSAGE };
  }

  /** Réinitialisation du mot de passe avec le token reçu par email */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const invalid = () =>
      new BadRequestException(
        'Lien invalide ou expiré. Veuillez demander un nouveau lien.',
      );

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
    });
    if (!record || record.expiresAt < new Date()) {
      throw invalid();
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      // Consommation atomique : si deux requêtes utilisent le même token en
      // parallèle, une seule supprime la ligne et applique le changement.
      const consumed = await tx.passwordResetToken.deleteMany({
        where: { id: record.id, expiresAt: { gte: new Date() } },
      });
      if (consumed.count !== 1) {
        throw invalid();
      }
      await tx.user.update({
        where: { id: record.userId },
        // tokenVersion++ : toutes les sessions existantes sont révoquées
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: record.userId },
      });
    });

    return { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' };
  }

  /**
   * Changement de mot de passe (utilisateur connecté). Révoque toutes les
   * sessions existantes (tokenVersion++) et renvoie un nouveau token pour la
   * session courante.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string; accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    return {
      message: 'Mot de passe mis à jour.',
      accessToken: this.signAccessToken(updated),
    };
  }

  private signAccessToken(
    user: Pick<User, 'id' | 'email' | 'tokenVersion'>,
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    return this.jwtService.sign(payload);
  }

  private buildAuthResponse(
    user: User & {
      subscriptions?: { status: string; currentPeriodEnd: Date | null }[];
    },
  ) {
    return {
      accessToken: this.signAccessToken(user),
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
        role: user.role,
        isPremium: effectivePremium(user),
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * N'échoue jamais : MailService journalise les erreurs sans le contenu du message, et ne
   * journalise le message simulé (MAIL_HOST absent) qu'au niveau debug hors production.
   */
  private async sendPasswordResetEmail(
    to: string,
    locale: string,
    resetLink: string,
  ): Promise<void> {
    try {
      const res = await this.mailService.sendPasswordReset(
        to,
        locale,
        resetLink,
      );
      if (!res.sent) {
        this.logger.error(
          "[PASSWORD_RESET] Échec d'envoi de l'email de réinitialisation.",
        );
      }
    } catch {
      this.logger.error(
        "[PASSWORD_RESET] Échec d'envoi de l'email de réinitialisation.",
      );
    }
  }
}
