import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityEnabledGuard } from './community-enabled.guard';
import { CommunityModerationService } from './community-moderation.service';
import { CommunityPostsService } from './community-posts.service';
import { CommunityProfileService } from './community-profile.service';
import { COMMUNITY_RULES_VERSION } from './community.constants';
import {
  ActivateProfileDto,
  AppealDto,
  CreateCommentDto,
  CreatePostDto,
  CursorQueryDto,
  FeedQueryDto,
  ReportDto,
  UpdateProfileDto,
} from './dto/community.dto';

type AuthedRequest = { user: { id: string } };

/**
 * Communauté (volet social) — routes des membres. Toutes exigent une session ; derrière
 * COMMUNITY_ENABLED (sinon 404 avant tout autre contrôle). Lecture et signalement : tout compte
 * connecté ; écriture : compte vérifié avec profil actif (403 avec code explicite sinon).
 */
@ApiTags('community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(CommunityEnabledGuard, JwtAuthGuard)
export class CommunityController {
  constructor(
    private readonly profiles: CommunityProfileService,
    private readonly posts: CommunityPostsService,
    private readonly moderation: CommunityModerationService,
  ) {}

  // ---------------------------------------------------------------- Profil

  @Get('rules')
  @ApiOperation({ summary: 'Current community rules version' })
  rules() {
    return { version: COMMUNITY_RULES_VERSION };
  }

  @Get('profile')
  @ApiOperation({ summary: 'My community profile and publishing eligibility' })
  getMyProfile(@Request() req: AuthedRequest) {
    return this.profiles.getMe(req.user.id);
  }

  @Post('profile')
  @ApiOperation({
    summary:
      'Activate my public profile (handle + acceptance of the community rules)',
  })
  @ApiResponse({
    status: 403,
    description: 'GUEST_ACCOUNT, EMAIL_NOT_VERIFIED, AGE_CONFIRMATION_REQUIRED',
  })
  @ApiResponse({
    status: 409,
    description: 'HANDLE_TAKEN, COMMUNITY_PROFILE_EXISTS',
  })
  activate(@Request() req: AuthedRequest, @Body() dto: ActivateProfileDto) {
    return this.profiles.activate(req.user.id, dto);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Change handle / avatar, or accept new rules' })
  update(@Request() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(req.user.id, dto);
  }

  @Delete('profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Leave the community: deletes my profile, posts, comments, likes and images',
  })
  async deactivate(@Request() req: AuthedRequest): Promise<void> {
    await this.profiles.deactivate(req.user.id);
  }

  @Get('users/:handle')
  @ApiOperation({ summary: 'Public profile of a member (never the e-mail)' })
  publicProfile(
    @Request() req: AuthedRequest,
    @Param('handle') handle: string,
  ) {
    return this.profiles.getPublic(req.user.id, handle);
  }

  @Get('users/:handle/posts')
  @ApiOperation({ summary: 'Posts of a member (cursor pagination)' })
  userPosts(
    @Request() req: AuthedRequest,
    @Param('handle') handle: string,
    @Query() q: CursorQueryDto,
  ) {
    return this.posts.userFeed(req.user.id, handle, q);
  }

  // -------------------------------------------------------------- Blocages

  @Get('blocks')
  @ApiOperation({ summary: 'Members I blocked' })
  blocks(@Request() req: AuthedRequest) {
    return this.profiles.listBlocks(req.user.id);
  }

  @Put('blocks/:handle')
  @ApiOperation({
    summary: 'Block a member (idempotent; content hidden both ways)',
  })
  block(@Request() req: AuthedRequest, @Param('handle') handle: string) {
    return this.profiles.block(req.user.id, handle);
  }

  @Delete('blocks/:handle')
  @ApiOperation({ summary: 'Unblock a member (idempotent)' })
  unblock(@Request() req: AuthedRequest, @Param('handle') handle: string) {
    return this.profiles.unblock(req.user.id, handle);
  }

  // ------------------------------------------------------------ Publications

  @Get('posts')
  @ApiOperation({
    summary: 'Recent feed (cursor; optional category and type filters)',
  })
  feed(@Request() req: AuthedRequest, @Query() q: FeedQueryDto) {
    return this.posts.feed(req.user.id, q);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Publish a PHOTO (1-4 images) or a QUESTION post' })
  @ApiResponse({ status: 429, description: 'COMMUNITY_RATE_LIMITED' })
  createPost(@Request() req: AuthedRequest, @Body() dto: CreatePostDto) {
    return this.posts.createPost(req.user.id, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Post detail with its first comments' })
  getPost(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.getPost(req.user.id, id);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my post (images included)' })
  async deletePost(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.posts.deletePost(req.user.id, id);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Comments of a post (cursor, chronological)' })
  comments(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: CursorQueryDto,
  ) {
    return this.posts.listComments(req.user.id, id, q.cursor, q.limit);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Comment a post, or reply to a top-level comment' })
  comment(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.posts.createComment(req.user.id, id, dto);
  }

  @Put('posts/:id/like')
  @ApiOperation({ summary: 'Like a post (idempotent)' })
  like(@Request() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.like(req.user.id, id);
  }

  @Delete('posts/:id/like')
  @ApiOperation({ summary: 'Remove my like (idempotent)' })
  unlike(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.unlike(req.user.id, id);
  }

  @Post('posts/:id/report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report a post (closed list of reasons; once per account)',
  })
  reportPost(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDto,
  ) {
    return this.moderation.report(req.user.id, 'POST', id, dto);
  }

  // ----------------------------------------------------------- Commentaires

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my comment (and its replies)' })
  async deleteComment(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.posts.deleteComment(req.user.id, id);
  }

  @Put('comments/:id/helpful')
  @ApiOperation({
    summary: 'Mark as helpful answer (author of the question only)',
  })
  markHelpful(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.markHelpful(req.user.id, id, true);
  }

  @Delete('comments/:id/helpful')
  @ApiOperation({ summary: 'Remove the helpful answer mark' })
  unmarkHelpful(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.markHelpful(req.user.id, id, false);
  }

  @Post('comments/:id/report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report a comment' })
  reportComment(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDto,
  ) {
    return this.moderation.report(req.user.id, 'COMMENT', id, dto);
  }

  // ------------------------------------------- Mes signalements (DSA art. 16(5))

  @Get('me/reports')
  @ApiOperation({
    summary:
      'Reports I filed: status (OPEN, ACTIONED, DISMISSED) and the decision taken',
  })
  myReports(@Request() req: AuthedRequest, @Query() q: CursorQueryDto) {
    return this.moderation.myReports(req.user.id, q.cursor, q.limit);
  }

  // ------------------------------------------- Décisions me concernant, recours

  @Get('me/decisions')
  @ApiOperation({ summary: 'Moderation decisions about my content or account' })
  myDecisions(@Request() req: AuthedRequest, @Query() q: CursorQueryDto) {
    return this.moderation.myDecisions(req.user.id, q.cursor, q.limit);
  }

  @Get('me/decisions/:id')
  @ApiOperation({
    summary: 'One moderation decision (statement of reasons, appeal state)',
  })
  myDecision(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.moderation.myDecision(req.user.id, id);
  }

  @Post('me/decisions/:id/appeal')
  @ApiOperation({
    summary: 'Appeal a decision (free, within 6 months, reviewed by a person)',
  })
  appeal(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppealDto,
  ) {
    return this.moderation.appeal(req.user.id, id, dto);
  }
}
