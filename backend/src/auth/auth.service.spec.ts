import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  Logger,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthService, hashResetToken } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CURRENT_TERMS_VERSION } from './auth.constants';

// Mock bcryptjs before importing (AuthService imports * as bcrypt from 'bcryptjs')
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

const bcryptMock = bcrypt as unknown as {
  hash: jest.Mock;
  compare: jest.Mock;
};

/** `data` du premier appel d'un mock Prisma (create/update). */
function firstCallData(fn: jest.Mock): Record<string, unknown> {
  const [arg] = fn.mock.calls[0] as [{ data: Record<string, unknown> }];
  return arg.data;
}

describe('AuthService', () => {
  let service: AuthService;
  let mailService: MailService;
  const serviceLogger = () => (service as unknown as { logger: Logger }).logger;
  const mailLogger = () =>
    (mailService as unknown as { logger: Logger }).logger;

  const mockUser = {
    id: 'user-id-123',
    email: 'test@captivia.com',
    passwordHash: 'hashed-password',
    locale: 'fr',
    isPremium: false,
    role: UserRole.USER,
    tokenVersion: 0,
    termsAcceptedAt: new Date(),
    termsVersion: CURRENT_TERMS_VERSION,
    emailVerifiedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    emailVerificationToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pushSubscription: {
      deleteMany: jest.fn(),
    },
    // Verrou de la ligne User (SELECT … FOR UPDATE)
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        MailService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mailService = module.get<MailService>(MailService);
    jest.clearAllMocks();
    mockPrismaService.$queryRaw.mockResolvedValue([mockUser]);
    // $transaction : tableau d'opérations OU callback interactif
    mockPrismaService.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof mockPrismaService) => unknown)(mockPrismaService)
        : Promise.all(arg as unknown[]),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@captivia.com',
      password: 'password123',
      locale: 'fr',
      acceptTerms: true,
      ageConfirmed: true,
    };

    it('should successfully register a new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          locale: mockUser.locale,
          role: UserRole.USER,
          isPremium: mockUser.isPremium,
          emailVerified: false,
          createdAt: mockUser.createdAt,
        },
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        tokenVersion: 0,
      });
    });

    it('stores terms acceptance date + current version and never sets a role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await service.register(registerDto);

      const data = firstCallData(mockPrismaService.user.create);
      expect(data.termsAcceptedAt).toBeInstanceOf(Date);
      expect(data.termsVersion).toBe(CURRENT_TERMS_VERSION);
      expect(data).not.toHaveProperty('role');
    });

    it('normalizes the email defensively (trim + lowercase)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await service.register({
        ...registerDto,
        email: '  NewUser@Captivia.COM ',
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@captivia.com' },
      });
      expect(firstCallData(mockPrismaService.user.create).email).toBe(
        'newuser@captivia.com',
      );
    });

    it('an operator-looking email registers as a plain USER (no premium)', async () => {
      const prev = process.env.OPERATOR_EMAILS;
      process.env.OPERATOR_EMAILS = 'op@example.com';
      try {
        mockPrismaService.user.findUnique.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
          ...mockUser,
          email: 'op@example.com',
        });
        const result = await service.register({
          ...registerDto,
          email: 'OP@EXAMPLE.COM',
        });
        expect(result.user.role).toBe(UserRole.USER);
        expect(result.user.isPremium).toBe(false);
      } finally {
        process.env.OPERATOR_EMAILS = prev;
      }
    });

    it('should hash password with bcrypt', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(bcryptMock.hash).toHaveBeenCalledWith(registerDto.password, 10);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );
    });

    it('should use default locale "fr" if not provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await service.register({ ...registerDto, locale: undefined });

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ locale: 'fr' }),
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@captivia.com',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt-token');
      bcryptMock.compare.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          locale: mockUser.locale,
          role: UserRole.USER,
          isPremium: mockUser.isPremium,
          emailVerified: false,
          createdAt: mockUser.createdAt,
        },
      });
    });

    it('looks the user up with the normalized email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true);

      await service.login({ ...loginDto, email: ' TEST@Captivia.com ' });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@captivia.com' },
        }),
      );
    });

    it('unknown user: still runs bcrypt.compare against a dummy hash, then 401', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        loginDto.password,
        expect.stringMatching(/^\$2[aby]\$10\$/),
      );
    });

    it('unknown user is rejected even if the dummy compare were to succeed', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      bcryptMock.compare.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user data without passwordHash', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.id, 0);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        locale: mockUser.locale,
        role: UserRole.USER,
        isPremium: mockUser.isPremium,
        emailVerified: false,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null when the token version is stale', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        tokenVersion: 2,
      });

      expect(await service.validateUser(mockUser.id, 1)).toBeNull();
      expect(await service.validateUser(mockUser.id)).toBeNull();
    });

    it('OPERATOR role grants effective premium', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.OPERATOR,
      });

      const result = await service.validateUser(mockUser.id, 0);
      expect(result).toMatchObject({
        role: UserRole.OPERATOR,
        isPremium: true,
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      expect(await service.validateUser('invalid-id')).toBeNull();
    });
  });

  describe('password reset', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      delete process.env.MAIL_HOST;
    });
    afterAll(() => {
      process.env = OLD_ENV;
    });

    it('stores only sha256(token) and never logs the link in production', async () => {
      process.env.NODE_ENV = 'production';
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      const warn = jest
        .spyOn(serviceLogger(), 'warn')
        .mockImplementation(() => {});
      const error = jest
        .spyOn(serviceLogger(), 'error')
        .mockImplementation(() => {});
      const log = jest
        .spyOn(serviceLogger(), 'log')
        .mockImplementation(() => {});
      const mailDebug = jest
        .spyOn(mailLogger(), 'debug')
        .mockImplementation(() => {});

      await service.requestPasswordReset('TEST@captivia.com');
      await new Promise((r) => setTimeout(r, 20));

      const data = firstCallData(mockPrismaService.passwordResetToken.create);
      expect(data).not.toHaveProperty('token');
      expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);

      const logged = [
        ...warn.mock.calls,
        ...error.mock.calls,
        ...log.mock.calls,
        ...mailDebug.mock.calls,
      ]
        .flat()
        .join(' ');
      expect(logged).not.toContain('reset-password?token=');
      expect(logged).not.toMatch(/[a-f0-9]{64}/);
    });

    it('logs the link in development only, and the logged token matches the stored hash', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.FRONTEND_URL;
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      const debug = jest
        .spyOn(mailLogger(), 'debug')
        .mockImplementation(() => {});

      await service.requestPasswordReset('test@captivia.com');
      await new Promise((r) => setTimeout(r, 20));

      const message = debug.mock.calls.flat().join(' ');
      const match = message.match(
        /http:\/\/localhost:3000\/reset-password\?token=([a-f0-9]{64})/,
      );
      expect(match).not.toBeNull();
      const stored = firstCallData(
        mockPrismaService.passwordResetToken.create,
      ).tokenHash;
      expect(stored).toBe(hashResetToken(match![1]));
      expect(stored).not.toBe(match![1]);
    });

    it('sends the reset e-mail through MailService in the user locale; a mail failure keeps the generic answer', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        locale: 'en',
      });
      jest.spyOn(serviceLogger(), 'error').mockImplementation(() => {});
      const send = jest
        .spyOn(mailService, 'sendPasswordReset')
        .mockRejectedValue(new Error('boom'));

      const res = await service.requestPasswordReset('test@captivia.com');
      await new Promise((r) => setTimeout(r, 20));

      expect(res.message).toMatch(/Si un compte existe/);
      expect(send).toHaveBeenCalledWith(
        mockUser.email,
        'en',
        expect.stringMatching(/\/reset-password\?token=[a-f0-9]{64}$/),
      );
    });

    it('unknown email: generic answer, nothing created', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const res = await service.requestPasswordReset('nobody@captivia.com');

      expect(res.message).toMatch(/Si un compte existe/);
      expect(
        mockPrismaService.passwordResetToken.create,
      ).not.toHaveBeenCalled();
    });

    it('resetPassword looks the token up by hash and bumps tokenVersion', async () => {
      const token = 'a'.repeat(64);
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrismaService.passwordResetToken.deleteMany.mockResolvedValue({
        count: 1,
      });
      bcryptMock.hash.mockResolvedValue('new-hash');

      await service.resetPassword(token, 'newPassword123');

      expect(
        mockPrismaService.passwordResetToken.findUnique,
      ).toHaveBeenCalledWith({
        where: { tokenHash: hashResetToken(token) },
      });
      // Verrou User, puis révocation de tous les accès (sessions, calendrier, push).
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: 'new-hash',
          tokenVersion: { increment: 1 },
          calendarToken: null,
        },
      });
      expect(
        mockPrismaService.pushSubscription.deleteMany,
      ).toHaveBeenCalledWith({ where: { userId: mockUser.id } });
    });

    it('resetPassword rejects an expired or already-consumed token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrismaService.passwordResetToken.deleteMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.resetPassword('b'.repeat(64), 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('bumps tokenVersion and returns a fresh token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true);
      bcryptMock.hash.mockResolvedValue('new-hash');
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        tokenVersion: 1,
      });
      mockJwtService.sign.mockReturnValue('fresh-token');

      const res = await service.changePassword(
        mockUser.id,
        'old',
        'newPassword123',
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: 'new-hash',
          tokenVersion: { increment: 1 },
          calendarToken: null,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
      );
      expect(res.accessToken).toBe('fresh-token');
      expect(res.refreshToken).toMatch(/^[a-f0-9]{64}$/);
      // Les refresh tokens existants sont révoqués
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('refuses when the password changed between the bcrypt check and the row lock', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { ...mockUser, passwordHash: 'changed-concurrently' },
      ]);
      bcryptMock.compare.mockResolvedValue(true);
      bcryptMock.hash.mockResolvedValue('new-hash');

      await expect(
        service.changePassword(mockUser.id, 'old', 'newPassword123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
