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
  Request,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/animal.dto';
import { UpdatePublicLinkDto } from './dto/public-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('animals')
@Controller('users/me/animals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new animal',
    description:
      'Add a new animal to your account (limit: 1 free, unlimited with premium)',
  })
  @ApiResponse({ status: 201, description: 'Animal created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Animal limit reached (premium required)',
  })
  async create(
    @Request() req: { user: { id: string } },
    @Body() createAnimalDto: CreateAnimalDto,
  ) {
    return this.animalsService.create(req.user.id, createAnimalDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all your animals',
    description: 'Retrieve all animals associated with your account',
  })
  @ApiResponse({ status: 200, description: 'Animals list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: { user: { id: string } },
    @Query() page: PaginationQueryDto,
  ) {
    return this.animalsService.findAll(req.user.id, page);
  }

  @Get(':id/public-link')
  @ApiOperation({
    summary:
      'Get the public sharing state of an animal (enabled, showHealth, slug, url). The URL is built server-side.',
  })
  @ApiParam({ name: 'id', description: 'Animal ID' })
  @ApiQuery({
    name: 'locale',
    required: false,
    description: 'Locale used in the public URL (fr, en, es, de, it, pt)',
  })
  @ApiResponse({ status: 200, description: 'Public link state' })
  async getPublicLink(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.animalsService.getPublicLink(id, req.user.id, locale);
  }

  @Patch(':id/public-link')
  @ApiOperation({
    summary:
      'Enable/disable the public page (QR) and choose whether vaccinations are shown. Enabling requires premium.',
  })
  @ApiParam({ name: 'id', description: 'Animal ID' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiResponse({ status: 200, description: 'Updated public link state' })
  @ApiResponse({ status: 403, description: 'Premium required to enable' })
  async updatePublicLink(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePublicLinkDto,
    @Query('locale') locale?: string,
  ) {
    return this.animalsService.updatePublicLink(id, req.user.id, dto, locale);
  }

  @Post(':id/public-link/regenerate')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Regenerate the public slug. The previous link (printed QR) stops working immediately.',
  })
  @ApiParam({ name: 'id', description: 'Animal ID' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiResponse({ status: 200, description: 'New public link state' })
  @ApiResponse({ status: 403, description: 'Premium required' })
  async regeneratePublicLink(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.animalsService.regeneratePublicLink(id, req.user.id, locale);
  }

  @Get(':id/offspring')
  @ApiOperation({
    summary: 'Get offspring of an animal',
    description:
      'List animals whose father or mother is this animal (Module F — portée)',
  })
  @ApiParam({ name: 'id', description: 'Animal ID (parent)' })
  @ApiResponse({ status: 200, description: 'Offspring list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async getOffspring(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query() page: PaginationQueryDto,
  ) {
    return this.animalsService.getOffspring(id, req.user.id, page);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an animal by ID',
    description: 'Retrieve detailed information about a specific animal',
  })
  @ApiParam({ name: 'id', description: 'Animal ID' })
  @ApiResponse({ status: 200, description: 'Animal details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.animalsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an animal',
    description: 'Update information about a specific animal',
  })
  @ApiParam({ name: 'id', description: 'Animal ID' })
  @ApiResponse({ status: 200, description: 'Animal updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateAnimalDto: UpdateAnimalDto,
  ) {
    return this.animalsService.update(id, req.user.id, updateAnimalDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an animal',
    description: 'Permanently delete an animal and all associated data',
  })
  @ApiParam({ name: 'id', description: 'Animal ID' })
  @ApiResponse({ status: 200, description: 'Animal deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.animalsService.remove(id, req.user.id);
  }
}
