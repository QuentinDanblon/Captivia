import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnimalHealthService } from './animal-health.service';
import { CreateHealthRecordDto, UpdateHealthRecordDto } from './dto/health-record.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/health-records')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnimalHealthController {
  constructor(private readonly healthService: AnimalHealthService) {}

  private ensurePremium(req: { user: { id: string; isPremium?: boolean } }) {
    if (!req.user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access the health record (carnet de santé).',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List health records (carnet de santé) for an animal' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Query() page: PaginationQueryDto,
  ) {
    this.ensurePremium(req);
    return this.healthService.findAll(animalId, req.user.id, page);
  }

  @Post()
  @ApiOperation({ summary: 'Add a health record (vaccine, surgery, etc.)' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateHealthRecordDto,
  ) {
    this.ensurePremium(req);
    return this.healthService.create(animalId, req.user.id, dto);
  }

  @Patch(':recordId')
  @ApiOperation({ summary: 'Update a health record' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'recordId', description: 'Health record ID' })
  async update(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateHealthRecordDto,
  ) {
    this.ensurePremium(req);
    return this.healthService.update(animalId, recordId, req.user.id, dto);
  }

  @Delete(':recordId')
  @ApiOperation({ summary: 'Delete a health record' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'recordId', description: 'Health record ID' })
  async remove(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('recordId') recordId: string,
  ) {
    this.ensurePremium(req);
    return this.healthService.remove(animalId, recordId, req.user.id);
  }
}
