import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, AuthenticatedUser } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  LogoutDto,
  RefreshTokenDto,
  VerifyEmailDto,
} from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AuthRateLimitGuard,
  GuestCreationRateLimitGuard,
} from '../common/guards/rate-limit.guard';
import { CreateGuestDto, UpgradeGuestDto } from './dto/guest.dto';
import { GuestForbidden, NoGuestGuard } from '../common/guest';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.register(registerDto, { userAgent });
  }

  @Post('guest')
  // Création anonyme : limite stricte par IP (anti-création massive de comptes).
  @UseGuards(GuestCreationRateLimitGuard)
  @ApiOperation({
    summary:
      'Start a guest session (« Essayer sans compte ») : creates a guest account without e-mail or password and returns {accessToken, refreshToken, user}',
  })
  @ApiResponse({ status: 201, description: 'Guest account created' })
  @ApiResponse({
    status: 429,
    description: 'Too many guest accounts from this IP',
  })
  async guest(
    @Body() dto: CreateGuestDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.createGuest(dto, { userAgent });
  }

  @Post('upgrade')
  @UseGuards(AuthRateLimitGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Convert the authenticated guest into an account (same user, data kept): e-mail, password, terms and age, like /auth/register. Returns a new token pair.',
  })
  @ApiResponse({ status: 201, description: 'Account created from the guest' })
  @ApiResponse({
    status: 403,
    description: 'Not a guest account (NOT_A_GUEST)',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered (no merge)',
  })
  async upgrade(
    @Request() req: { user: { id: string } },
    @Body() dto: UpgradeGuestDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.upgradeGuest(req.user.id, dto, { userAgent });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(loginDto, { userAgent });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotate the refresh token: returns a new {accessToken, refreshToken}. Reusing an already-rotated token revokes the whole session family.',
  })
  @ApiResponse({ status: 200, description: 'New token pair' })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, revoked or reused refresh token',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.refresh(dto.refreshToken, { userAgent });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoke the session (refresh token family) of the given refresh token; optionally remove this device push subscription (endpoint) and native push token (deviceToken)',
  })
  @ApiResponse({ status: 200, description: 'Logged out (idempotent)' })
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(
      dto.refreshToken,
      dto.endpoint,
      dto.deviceToken,
    );
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Log out from all devices (revokes every refresh token, invalidates access tokens, disables the calendar feed link and removes push subscriptions)',
  })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  async logoutAll(@Request() req: { user: { id: string } }) {
    return this.authService.logoutAll(req.user.id);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({
    summary: 'Verify the email address with the token received by email',
  })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard, JwtAuthGuard, NoGuestGuard)
  @GuestForbidden('email_verification')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Resend the email verification link (max 1/min and 5 per 24 h per account)',
  })
  @ApiResponse({ status: 200, description: 'Email sent (or already verified)' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendVerification(@Request() req: { user: { id: string } }) {
    return this.authService.resendEmailVerification(req.user.id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'If account exists, email sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, NoGuestGuard)
  @GuestForbidden('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (authenticated user)' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
      { userAgent },
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Request() req: { user: AuthenticatedUser }) {
    return req.user;
  }
}
