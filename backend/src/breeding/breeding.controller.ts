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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BreedingService } from './breeding.service';
import {
  CreateBreedingRecordDto,
  UpdateBreedingRecordDto,
} from './dto/breeding-record.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('animals')
@Controller('users/me/animals/:animalId/breeding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BreedingController {
  constructor(private readonly breedingService: BreedingService) {}

  private ensurePremium(req: { user: { id: string; isPremium?: boolean } }) {
    if (!req.user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access breeding records.',
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'List breeding records for an animal (sorted by date desc)',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async findAll(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Query() page: PaginationQueryDto,
  ) {
    this.ensurePremium(req);
    return this.breedingService.findAll(animalId, req.user.id, page);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a breeding record (heat, mating, pregnancy, birth, weaning)',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  async create(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Body() dto: CreateBreedingRecordDto,
  ) {
    this.ensurePremium(req);
    return this.breedingService.create(animalId, req.user.id, dto);
  }

  @Patch(':recordId')
  @ApiOperation({ summary: 'Update a breeding record' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'recordId', description: 'Breeding record ID' })
  async update(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateBreedingRecordDto,
  ) {
    this.ensurePremium(req);
    return this.breedingService.update(animalId, recordId, req.user.id, dto);
  }

  @Delete(':recordId')
  @ApiOperation({ summary: 'Delete a breeding record' })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'recordId', description: 'Breeding record ID' })
  async remove(
    @Req() req: { user: { id: string; isPremium?: boolean } },
    @Param('animalId') animalId: string,
    @Param('recordId') recordId: string,
  ) {
    this.ensurePremium(req);
    return this.breedingService.remove(animalId, recordId, req.user.id);
  }
}
