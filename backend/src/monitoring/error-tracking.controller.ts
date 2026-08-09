import { Controller, Get, Delete, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorTrackingService } from './error-tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('error-tracking')
@Controller('errors')
@UseGuards(JwtAuthGuard, OperatorGuard)
export class ErrorTrackingController {
  constructor(private readonly errorTrackingService: ErrorTrackingService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get error statistics' })
  @ApiResponse({ status: 200, description: 'Returns error statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getErrorStats() {
    return await this.errorTrackingService.getErrorStats();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent errors' })
  @ApiResponse({ status: 200, description: 'Returns recent errors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecentErrors(@Query('limit') limit: string = '50') {
    return await this.errorTrackingService.getRecentErrors(parseInt(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get error by ID' })
  @ApiResponse({ status: 200, description: 'Returns error details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getErrorById(@Param('id') id: string) {
    return await this.errorTrackingService.getErrorById(id);
  }

  @Delete('clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear old errors' })
  @ApiResponse({ status: 204, description: 'Old errors cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearOldErrors(@Query('days') days: string = '7') {
    await this.errorTrackingService.clearOldErrors(parseInt(days));
  }

  @Get('export')
  @ApiOperation({ summary: 'Export errors' })
  @ApiResponse({ status: 200, description: 'Returns exported errors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportErrors(
    @Query('format') format: string = 'json',
    @Query('days') days: string = '7'
  ) {
    return await this.errorTrackingService.exportErrors(format as 'json' | 'csv', parseInt(days));
  }

  @Delete('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset error tracking' })
  @ApiResponse({ status: 204, description: 'Error tracking reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetErrorTracking() {
    await this.errorTrackingService.resetErrorTracking();
  }
}