import {
  Controller,
  Get,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, OperatorGuard)
export class MonitoringController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({ status: 200, description: 'Returns system metrics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMetrics() {
    return await this.metricsService.getMetrics();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'Returns health status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHealthStatus() {
    return await this.metricsService.getHealthStatus();
  }

  @Delete('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset all metrics' })
  @ApiResponse({ status: 204, description: 'Metrics reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetMetrics() {
    await this.metricsService.resetMetrics();
  }
}
