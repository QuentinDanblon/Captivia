import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseOptimizationService } from './database-optimization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('database')
@Controller('database')
@UseGuards(JwtAuthGuard, OperatorGuard)
export class DatabaseOptimizationController {
  constructor(
    private readonly optimizationService: DatabaseOptimizationService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get database optimization stats' })
  @ApiResponse({ status: 200, description: 'Returns database stats' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDatabaseStats() {
    return await this.optimizationService.getDatabaseStats();
  }

  @Post('optimize-cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Optimize query cache' })
  @ApiResponse({ status: 204, description: 'Cache optimized successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async optimizeQueryCache() {
    await this.optimizationService.optimizeQueryCache();
  }

  @Delete('stats/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset database stats' })
  @ApiResponse({ status: 204, description: 'Stats reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetDatabaseStats() {
    await this.optimizationService.resetDatabaseStats();
  }
}
