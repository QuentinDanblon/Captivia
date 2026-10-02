import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
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
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  normalizeEmail,
} from './auth.constants';

/** Paire de jetons renvoyée par login / register / refresh / change-password (W1-01). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Contexte de la requête qui émet une session (journalisé avec le refresh token). */
export interface SessionContext {
  userAgent?: string | null;
}

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

/** Même empreinte sha256 pour les refresh tokens et les tokens de vérification d'e-mail. */
export const hashOpaqueToken = hashResetToken;

/** Token opaque : 32 octets aléatoires en hexadécimal (64 caractères). */
function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
}

const INVALID_REFRESH_MESSAGE = 'Session expirée. Veuillez vous reconnecter.';

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

  async register(registerDto: RegisterDto, context: SessionContext = {}) {
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

    // W2-04 : e-mail de vérification (non bloquant, n'échoue jamais).
    void this.issueEmailVerification(user).catch(() => undefined);

    return this.buildAuthResponse(user, context);
  }

  async login(loginDto: LoginDto, context: SessionContext = {}) {
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

    return this.buildAuthResponse(user, context);
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
      emailVerified: user.emailVerifiedAt !== null,
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
      // W1-01 : les refresh tokens existants sont révoqués avec les access tokens.
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
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
    context: SessionContext = {},
  ): Promise<{ message: string } & TokenPair> {
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
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
    });
    return {
      message: 'Mot de passe mis à jour.',
      ...(await this.issueTokenPair(updated, context)),
    };
  }

  // ---------------------------------------------------------------------------
  // W1-01 — refresh tokens rotatifs
  // ---------------------------------------------------------------------------

  /**
   * Émet un access token + un refresh token. `familyId` absent = nouvelle session
   * (nouvelle famille de rotation).
   */
  private async issueTokenPair(
    user: Pick<User, 'id' | 'email' | 'tokenVersion'>,
    context: SessionContext,
    familyId: string = crypto.randomUUID(),
  ): Promise<TokenPair> {
    const refreshToken = generateOpaqueToken();
    const now = Date.now();
    await this.prisma.$transaction([
      // Purge opportuniste des refresh tokens expirés du compte
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date(now) } },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(refreshToken),
          familyId,
          expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
          userAgent: this.truncateUserAgent(context.userAgent),
        },
      }),
    ]);
    return { accessToken: this.signAccessToken(user), refreshToken };
  }

  /**
   * Rotation : le refresh token présenté est consommé et remplacé. Présenter un
   * token déjà roté (vol probable) révoque toute la famille (toutes les rotations
   * de cette session).
   */
  async refresh(
    rawRefreshToken: string,
    context: SessionContext = {},
  ): Promise<TokenPair> {
    const invalid = () => new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashOpaqueToken(rawRefreshToken) },
      include: { user: true },
    });
    if (!record) throw invalid();

    if (record.replacedById) {
      await this.revokeFamily(record.familyId, 'réutilisation détectée');
      throw invalid();
    }
    if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
      throw invalid();
    }

    const newToken = generateOpaqueToken();
    const newId = crypto.randomUUID();
    const now = new Date();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Consommation atomique : deux rotations concurrentes du même token → une seule gagne.
      const claimed = await tx.refreshToken.updateMany({
        where: {
          id: record.id,
          revokedAt: null,
          replacedById: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now, replacedById: newId },
      });
      if (claimed.count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          id: newId,
          userId: record.userId,
          tokenHash: hashOpaqueToken(newToken),
          familyId: record.familyId,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
          userAgent: this.truncateUserAgent(context.userAgent),
        },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(record.familyId, 'rotation concurrente');
      throw invalid();
    }

    return {
      accessToken: this.signAccessToken(record.user),
      refreshToken: newToken,
    };
  }

  /** Révoque la session (famille) du refresh token présenté. Idempotent, ne révèle rien. */
  async logout(rawRefreshToken: string): Promise<{ message: string }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashOpaqueToken(rawRefreshToken) },
      select: { familyId: true },
    });
    if (record) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Déconnecté.' };
  }

  /** « Se déconnecter de tous les appareils » : refresh tokens révoqués + tokenVersion++. */
  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
    return { message: 'Toutes les sessions ont été déconnectées.' };
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    const res = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.warn(
      `[REFRESH] Famille de session révoquée (${reason}) : ${res.count} token(s).`,
    );
  }

  private truncateUserAgent(ua?: string | null): string | null {
    const value = typeof ua === 'string' ? ua.trim() : '';
    return value ? value.slice(0, 255) : null;
  }

  // ---------------------------------------------------------------------------
  // W2-04 — vérification d'e-mail
  // ---------------------------------------------------------------------------

  /** Crée un token de vérification (24 h, haché) et envoie l'e-mail. */
  private async issueEmailVerification(
    user: Pick<User, 'id' | 'email' | 'locale'>,
  ): Promise<void> {
    const token = generateOpaqueToken();
    await this.prisma.$transaction([
      // Un seul lien actif par compte + purge opportuniste des tokens expirés
      this.prisma.emailVerificationToken.deleteMany({
        where: {
          OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }],
        },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      }),
    ]);
    const link = `${frontendBaseUrl()}/verifier-email?token=${token}`;
    try {
      const res = await this.mailService.sendEmailVerification(
        user.email,
        user.locale,
        link,
      );
      if (!res.sent) {
        this.logger.error(
          "[EMAIL_VERIFICATION] Échec d'envoi de l'e-mail de vérification.",
        );
      }
    } catch {
      this.logger.error(
        "[EMAIL_VERIFICATION] Échec d'envoi de l'e-mail de vérification.",
      );
    }
  }

  /** Consomme le token et marque l'adresse comme vérifiée. */
  async verifyEmail(
    token: string,
  ): Promise<{ message: string; emailVerified: true }> {
    const invalid = () =>
      new BadRequestException(
        'Lien de vérification invalide ou expiré. Demandez un nouveau lien.',
      );
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw invalid();
    }
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.deleteMany({
        where: { id: record.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw invalid();
      await tx.user.updateMany({
        where: { id: record.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      await tx.emailVerificationToken.deleteMany({
        where: { userId: record.userId },
      });
    });
    return { message: 'Adresse e-mail vérifiée.', emailVerified: true };
  }

  /** Renvoi du lien (utilisateur connecté), limité à un envoi par minute et par compte. */
  async resendEmailVerification(
    userId: string,
  ): Promise<{ message: string; alreadyVerified: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, locale: true, emailVerifiedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) {
      return {
        message: 'Adresse e-mail déjà vérifiée.',
        alreadyVerified: true,
      };
    }
    const recent = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        createdAt: {
          gt: new Date(Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS),
        },
      },
      select: { createdAt: true },
    });
    if (recent) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (recent.createdAt.getTime() +
            EMAIL_VERIFICATION_RESEND_COOLDOWN_MS -
            Date.now()) /
            1000,
        ),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Un e-mail de vérification vient d’être envoyé. Réessayez dans un instant.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.issueEmailVerification(user);
    return {
      message: 'E-mail de vérification envoyé.',
      alreadyVerified: false,
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

  private async buildAuthResponse(
    user: User & {
      subscriptions?: { status: string; currentPeriodEnd: Date | null }[];
    },
    context: SessionContext,
  ) {
    return {
      ...(await this.issueTokenPair(user, context)),
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
        role: user.role,
        isPremium: effectivePremium(user),
        emailVerified: user.emailVerifiedAt !== null,
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
