import { Throttle } from '@nestjs/throttler';
import { EXTERNAL_API_THROTTLE } from '../config/throttle.config';
import { BadRequestException, Controller, Get, Query, Param, NotFoundException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { OpenPetFoodFactsService } from './services/openpetfoodfacts.service';
import { FoodSearchDto } from './dto/food-search.dto';
import { isValidBarcode } from '../external/http-safety';

@ApiTags('food')
@Controller('food')
@Throttle(EXTERNAL_API_THROTTLE)
export class FoodController {
  constructor(
    private readonly openPetFoodFactsService: OpenPetFoodFactsService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search pet food products',
    description:
      'Search for pet food products in Open Pet Food Facts database',
  })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'category', required: false, description: 'Food category' })
  @ApiQuery({ name: 'species', required: false, description: 'Animal species' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'Food products found' })
  async searchFood(@Query() query: FoodSearchDto): Promise<unknown> {
    return this.openPetFoodFactsService.searchProducts(
      query.q,
      query.category,
      query.page || 1,
      query.pageSize || 20,
    );
  }

  @Get('product/:barcode')
  @ApiOperation({
    summary: 'Get product by barcode',
    description: 'Get detailed information about a pet food product by barcode',
  })
  @ApiParam({ name: 'barcode', description: 'Product barcode/EAN' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProduct(@Param('barcode') barcode: string): Promise<unknown> {
    if (!isValidBarcode(barcode)) {
      throw new BadRequestException('barcode must be 8 to 14 digits');
    }
    const product = await this.openPetFoodFactsService.getProduct(barcode);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get food categories',
    description: 'Get list of available pet food categories',
  })
  @ApiResponse({ status: 200, description: 'Categories list' })
  async getCategories() {
    return this.openPetFoodFactsService.getCategories();
  }

  @Get('species/:species')
  @ApiOperation({
    summary: 'Get food products for a species',
    description: 'Get recommended food products for a specific animal species (uses mapping by species name + Open Pet Food Facts)',
  })
  @ApiParam({ name: 'species', description: 'Animal species (e.g., dog, cat, Boa constrictor)' })
  @ApiQuery({ name: 'type', required: false, description: 'Food type (dry, wet, treats)' })
  @ApiResponse({ status: 200, description: 'Food products for species' })
  async getFoodBySpecies(
    @Param('species') species: string,
    @Query('type') type?: string,
  ) {
    try {
      return await this.openPetFoodFactsService.searchBySpecies(species, type);
    } catch {
      return { products: [], count: 0, page: 1 };
    }
  }
}
