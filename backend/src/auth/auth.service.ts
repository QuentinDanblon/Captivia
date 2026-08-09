import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { isOperatorEmail } from '../common/operators';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Premium effectif : abonnement actif OU email d'opérateur (OPERATOR_EMAILS,
 * comparaison insensible à la casse — logique centralisée dans common/operators.ts).
 */
function effectivePremium(user: { email: string; isPremium: boolean }): boolean {
  if (user.isPremium) return true;
  return isOperatorEmail(user.email);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, locale } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (P2002 = email déjà pris en cas de course entre deux
    // inscriptions simultanées : le findUnique ci-dessus ne suffit pas)
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          locale: locale || 'fr',
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

    // Generate JWT
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
        isPremium: effectivePremium(user),
        createdAt: user.createdAt,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
        isPremium: effectivePremium(user),
        createdAt: user.createdAt,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      locale: user.locale,
      isPremium: effectivePremium(user),
    };
  }

  /** Demande de récupération de mot de passe : crée un token et envoie l'email (ou log en dev) */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return { message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      }),
    ]);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await this.sendPasswordResetEmail(user.email, resetLink);

    return { message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.' };
  }

  /** Réinitialisation du mot de passe avec le token reçu par email */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré. Veuillez demander un nouveau lien.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);

    return { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' };
  }

  /** Changement de mot de passe (utilisateur connecté) */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
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
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: 'Mot de passe mis à jour.' };
  }

  private async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const host = process.env.MAIL_HOST;
    if (host) {
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.MAIL_PORT || '587', 10),
        secure: process.env.MAIL_SECURE === 'true',
        auth: process.env.MAIL_USER
          ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
          : undefined,
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Captivia <noreply@captivia.com>',
        to,
        subject: 'Réinitialisation de votre mot de passe Captivia',
        text: `Bonjour,\n\nCliquez sur le lien suivant pour réinitialiser votre mot de passe :\n${resetLink}\n\nCe lien expire dans 1 heure.\n\nL'équipe Captivia`,
        html: `<p>Bonjour,</p><p>Cliquez sur le lien suivant pour réinitialiser votre mot de passe :</p><p><a href="${resetLink}">${resetLink}</a></p><p>Ce lien expire dans 1 heure.</p><p>L'équipe Captivia</p>`,
      });
    } else {
      // A NE PAS FAIRE EN PROD - le lien doit passer par email (fallback dev sans SMTP).
      this.logger.warn(
        `[PASSWORD_RESET] Lien de réinitialisation (MAIL_HOST non configuré) : ${resetLink}`,
      );
    }
  }
}
