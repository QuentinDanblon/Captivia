import { Controller, Get, Post, Delete, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAnalyticsService } from './api-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, OperatorGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: ApiAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get API usage analytics' })
  @ApiResponse({ status: 200, description: 'Returns API usage analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAnalytics(@Query() query: any) {
    return await this.analyticsService.getAnalytics(query);
  }

  @Get('daily/:date')
  @ApiOperation({ summary: 'Get daily report' })
  @ApiResponse({ status: 200, description: 'Returns daily report' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDailyReport(@Param('date') date: string) {
    return await this.analyticsService.getDailyReport(date);
  }

  @Get('traffic-trend')
  @ApiOperation({ summary: 'Get traffic trend' })
  @ApiResponse({ status: 200, description: 'Returns traffic trend data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTrafficTrend(@Query('days') days: string = '7') {
    return await this.analyticsService.getTrafficTrend(parseInt(days));
  }

  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track API request' })
  @ApiResponse({ status: 204, description: 'Request tracked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async trackRequest(
    @Query('endpoint') endpoint: string,
    @Query('userId') userId: string,
    @Query('duration') duration: string
  ) {
    await this.analyticsService.trackRequest(endpoint, userId, parseInt(duration));
  }

  @Get('export/:date')
  @ApiOperation({ summary: 'Export analytics report' })
  @ApiResponse({ status: 200, description: 'Returns exported report' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportReport(
    @Param('date') date: string,
    @Query('format') format: string = 'json'
  ) {
    return await this.analyticsService.exportReport(date, format as 'json' | 'csv');
  }

  @Delete('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset analytics data' })
  @ApiResponse({ status: 204, description: 'Analytics data reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetAnalytics() {
    await this.analyticsService.resetAnalytics();
  }
}