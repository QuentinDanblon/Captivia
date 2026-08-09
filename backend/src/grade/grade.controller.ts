import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GradeService } from './grade.service';

@ApiTags('grade')
@Controller('users/me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GradeController {
  constructor(private readonly gradeService: GradeService) {}

  @Get('grade')
  @ApiOperation({ summary: 'Get current grade, points and progress' })
  async getGrade(@Request() req: { user: { id: string } }) {
    return this.gradeService.getGrade(req.user.id);
  }

  @Get('notification-events')
  @ApiOperation({ summary: 'Get notification events for a day (default today), create from preferences if empty' })
  async getNotificationEvents(
    @Request() req: { user: { id: string } },
    @Query('date') date?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.gradeService.getOrCreateTodayEvents(req.user.id, date, refresh === '1' || refresh === 'true');
  }

  @Patch('notification-events/:id')
  @ApiOperation({ summary: 'Mark event as done (gain points) or skipped' })
  async setEventStatus(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { status: 'done' | 'skipped' },
  ) {
    if (!body?.status || !['done', 'skipped'].includes(body.status)) {
      throw new BadRequestException('status must be done or skipped');
    }
    const result = await this.gradeService.setEventStatus(req.user.id, id, body.status);
    if (!result) {
      throw new NotFoundException('Notification event not found');
    }
    return result;
  }

  @Delete('notification-events/:id')
  @ApiOperation({ summary: 'Delete a reminder for the day' })
  async deleteEvent(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    const deleted = await this.gradeService.deleteEvent(req.user.id, id);
    if (!deleted) {
      throw new NotFoundException('Notification event not found');
    }
    return { deleted };
  }
}
