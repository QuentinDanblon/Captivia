import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthRateLimitGuard,
  RateLimitGuard,
} from '../common/guards/rate-limit.guard';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('account')
@ApiBearerAuth()
@Controller('users/me')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  // Limite stricte (10/min/IP) : la route re-vérifie un mot de passe.
  @UseGuards(JwtAuthGuard, AuthRateLimitGuard)
  @ApiOperation({
    summary: 'Delete my account and all my data (password required)',
  })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized or wrong password' })
  async deleteMe(
    @Request() req: { user: { id: string } },
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    await this.accountService.deleteAccount(req.user.id, dto.password);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @ApiOperation({
    summary: 'Export all my data as JSON (GDPR art. 20, free for everyone)',
  })
  @ApiResponse({ status: 200, description: 'JSON export (attachment)' })
  async exportMe(
    @Request() req: { user: { id: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.accountService.exportData(req.user.id);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="captivia-export-${date}.json"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return data;
  }
}
