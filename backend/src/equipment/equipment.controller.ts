import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import {
  EquipmentQueryDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('equipment')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @ApiOperation({
    summary: 'Get recommended equipment',
    description:
      'Get the recommended equipment list (editorial taxonomy)',
  })
  @ApiQuery({
    name: 'speciesId',
    required: false,
    description: 'Filter by species (GBIF key)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category (chauffage, uvb, substrat, etc.)',
  })
  @ApiQuery({
    name: 'size',
    required: false,
    description: 'Filter by animal size (small, medium, large)',
  })
  @ApiResponse({ status: 200, description: 'Equipment recommendations' })
  async getRecommendedEquipment(@Query() query: EquipmentQueryDto): Promise<unknown> {
    return this.equipmentService.getRecommendedEquipment(
      query.speciesId,
      query.category,
      query.size,
      query,
    );
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get equipment categories',
    description: 'Get list of available equipment categories',
  })
  @ApiResponse({ status: 200, description: 'Categories list' })
  async getCategories() {
    return this.equipmentService.getCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, OperatorGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create equipment recommendation (admin only)',
    description: 'Add a new equipment recommendation to the taxonomy',
  })
  @ApiResponse({ status: 201, description: 'Recommendation created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createRecommendation(@Body() data: CreateEquipmentDto) {
    return this.equipmentService.createRecommendation(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OperatorGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update equipment recommendation (admin only)',
    description: 'Update an existing equipment recommendation',
  })
  @ApiParam({ name: 'id', description: 'Recommendation ID' })
  @ApiResponse({ status: 200, description: 'Recommendation updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateRecommendation(
    @Param('id') id: string,
    @Body() data: UpdateEquipmentDto,
  ) {
    return this.equipmentService.updateRecommendation(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OperatorGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete equipment recommendation (admin only)',
    description: 'Delete an equipment recommendation',
  })
  @ApiParam({ name: 'id', description: 'Recommendation ID' })
  @ApiResponse({ status: 200, description: 'Recommendation deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteRecommendation(@Param('id') id: string) {
    return this.equipmentService.deleteRecommendation(id);
  }
}
