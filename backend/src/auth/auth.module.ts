import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GuestPurgeService } from './guest-purge.service';
import { ACCESS_TOKEN_TTL, JWT_ALGORITHM } from './auth.constants';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PassportModule,
    MailModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: {
            expiresIn: ACCESS_TOKEN_TTL,
            algorithm: JWT_ALGORITHM,
          },
          verifyOptions: { algorithms: [JWT_ALGORITHM] },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GuestPurgeService],
  exports: [AuthService, GuestPurgeService],
})
export class AuthModule {}
