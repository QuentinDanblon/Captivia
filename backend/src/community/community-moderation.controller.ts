import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';
import { CommunityEnabledGuard } from './community-enabled.guard';
import {
  CommunityModerationService,
  ContentType,
} from './community-moderation.service';
import {
  CursorQueryDto,
  ModerationDecisionDto,
  ModerationNoteDto,
  ModerationQueueQueryDto,
  ResolveAppealDto,
  SuspendDto,
} from './dto/community.dto';

type AuthedRequest = { user: { id: string } };

/**
 * File de modération (opérateurs, e-mail vérifié). Chaque décision exige un motif et/ou un
 * exposé des motifs, est consignée au journal et notifiée à l'auteur (DSA art. 17).
 * Procédure : docs/RUNBOOK.md, « Modération de la communauté ».
 */
@ApiTags('community-moderation')
@ApiBearerAuth()
@Controller('community/moderation')
@UseGuards(CommunityEnabledGuard, JwtAuthGuard, OperatorGuard)
export class CommunityModerationController {
  constructor(private readonly moderation: CommunityModerationService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Contents with open reports, oldest report first' })
  queue(@Query() q: ModerationQueueQueryDto) {
    return this.moderation.queue(q.limit, q.offset);
  }

  @Get('hidden')
  @ApiOperation({ summary: 'Hidden contents (automatic or by an operator)' })
  hidden(@Query() q: ModerationQueueQueryDto) {
    return this.moderation.hidden(q.limit);
  }

  @Get('log')
  @ApiOperation({ summary: 'Moderation decisions log' })
  log(@Query() q: CursorQueryDto) {
    return this.moderation.log(q.cursor, q.limit);
  }

  @Get('appeals')
  @ApiOperation({ summary: 'Pending appeals' })
  appeals(@Query() q: ModerationQueueQueryDto) {
    return this.moderation.pendingAppeals(q.limit);
  }

  @Post('appeals/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve an appeal: UPHELD or REVERSED (author notified)',
  })
  resolveAppeal(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.moderation.resolveAppeal(req.user.id, id, dto);
  }

  // Publications et commentaires : mêmes actions.

  @Post(':kind/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hide a post or comment (reason + statement, author notified)',
  })
  hide(
    @Request() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationDecisionDto,
  ) {
    return this.moderation.hide(req.user.id, contentType(kind), id, dto);
  }

  @Post(':kind/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a hidden post or comment (author notified)',
  })
  restore(
    @Request() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationNoteDto,
  ) {
    return this.moderation.restore(req.user.id, contentType(kind), id, dto);
  }

  @Post(':kind/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dismiss the open reports (no automatic hiding afterwards)',
  })
  dismiss(
    @Request() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationNoteDto,
  ) {
    return this.moderation.dismiss(req.user.id, contentType(kind), id, dto);
  }

  @Post(':kind/:id/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a post or comment (images included, author notified)',
  })
  remove(
    @Request() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationDecisionDto,
  ) {
    return this.moderation.remove(req.user.id, contentType(kind), id, dto);
  }

  @Post('users/:handle/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend publishing for a member (1-365 days, notified)',
  })
  suspend(
    @Request() req: AuthedRequest,
    @Param('handle') handle: string,
    @Body() dto: SuspendDto,
  ) {
    return this.moderation.suspend(req.user.id, handle, dto);
  }

  @Post('users/:handle/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift a publishing suspension (notified)' })
  unsuspend(
    @Request() req: AuthedRequest,
    @Param('handle') handle: string,
    @Body() dto: ModerationNoteDto,
  ) {
    return this.moderation.unsuspend(req.user.id, handle, dto);
  }
}

/** `posts` → POST, `comments` → COMMENT ; tout autre segment : route inconnue (404). */
function contentType(kind: string): ContentType {
  if (kind === 'posts') return 'POST';
  if (kind === 'comments') return 'COMMENT';
  throw new NotFoundException();
}
