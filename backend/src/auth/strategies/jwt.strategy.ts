import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';
import { JWT_ALGORITHM } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      // Refuse tout autre algorithme (alg=none, confusion RS/HS…)
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload) {
    if (typeof payload?.sub !== 'string') {
      throw new UnauthorizedException();
    }
    // Tokens émis avant l'introduction de tokenVersion : traités comme version 0
    // (ils deviennent invalides dès le premier changement / reset de mot de passe).
    const tokenVersion = payload.tokenVersion ?? 0;
    if (!Number.isInteger(tokenVersion)) {
      throw new UnauthorizedException();
    }

    const user = await this.authService.validateUser(payload.sub, tokenVersion);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
