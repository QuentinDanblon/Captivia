import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../../cache/cache.service';

interface PetFoodProduct {
  code: string;
  product_name: string;
  brands: string;
  categories: string;
  image_url?: string;
  ingredients_text?: string;
  nutrition_grades?: string;
  allergens?: string;
  labels?: string;
  quantity?: string;
}

@Injectable()
export class OpenPetFoodFactsService {
  private readonly logger = new Logger(OpenPetFoodFactsService.name);
  private readonly baseUrl = 'https://world.openpetfoodfacts.org/api/v2';
  private readonly cachePrefix = 'opff:';

  // Mapping of species/keywords to appropriate search terms (animal-linked database)
  private readonly speciesSearchTerms: Record<string, string[]> = {
    // Reptiles - general
    reptile: ['reptile food', 'reptile', 'insect food'],
    snake: ['snake food', 'frozen rodent', 'reptile', 'mouse'],
    boa: ['snake food', 'reptile', 'frozen rodent', 'mice'],
    constrictor: ['snake food', 'reptile', 'frozen rodent'],
    python: ['snake food', 'reptile', 'frozen rodent', 'mice'],
    // Reptiles - specific
    iguana: ['iguana food', 'reptile vegetables', 'leafy greens'],
    gecko: ['gecko food', 'insect food', 'dubia roaches', 'crickets'],
    leopard: ['gecko food', 'insect food', 'dubia roaches'],
    turtle: ['turtle food', 'reptile', 'aquatic feed'],
    tortoise: ['tortoise food', 'reptile vegetables'],
    trachemys: ['turtle food', 'reptile', 'aquatic'],
    // Amphibians
    frog: ['frog food', 'insect food', 'crickets'],
    salamander: ['salamander food', 'insect food'],
    amphibian: ['amphibian food', 'insect food', 'crickets'],
    // Birds (oiseaux)
    bird: ['bird food', 'parrot', 'seed mix'],
    oiseau: ['bird food', 'oiseau', 'graines'],
    parrot: ['parrot food', 'bird', 'nuts'],
    canary: ['canary food', 'bird seed'],
    canaria: ['canary food', 'bird seed'],
    serinus: ['canary food', 'bird seed'],
    perruche: ['parrot food', 'bird', 'seed mix'],
    budgerigar: ['parrot food', 'bird seed'],
    cockatiel: ['cockatiel food', 'bird', 'seed'],
    // Mammals - rodents
    hamster: ['hamster food', 'rodent', 'seed mix'],
    mouse: ['mouse food', 'rodent', 'seed'],
    rat: ['rat food', 'rodent', 'pellets'],
    guinea: ['guinea pig food', 'hay', 'pellets'],
    rabbit: ['rabbit food', 'hay', 'pellets'],
    // Mammals - carnivores
    dog: ['dog food', 'dog'],
    cat: ['cat food', 'cat'],
    ferret: ['ferret food', 'meat'],
    // Fish
    fish: ['fish food', 'aquarium', 'flakes'],
    poisson: ['fish food', 'aquarium', 'flakes'],
  };

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get appropriate search terms for a species
   */
  private getSearchTermsForSpecies(species: string): string[] {
    const speciesLower = species.toLowerCase();
    
    // Direct match
    if (this.speciesSearchTerms[speciesLower]) {
      return this.speciesSearchTerms[speciesLower];
    }

    // Partial match
    for (const [key, terms] of Object.entries(this.speciesSearchTerms)) {
      if (speciesLower.includes(key) || key.includes(speciesLower)) {
        return terms;
      }
    }

    // Default for unknown species: try the species name + 'food'
    return [species, `${species} food`];
  }

  async searchProducts(
    query: string,
    category?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ products: PetFoodProduct[]; count: number; page: number }> {
    const cacheKey = `${this.cachePrefix}search:${query}:${category || 'all'}:${page}:${pageSize}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      let searchUrl = `${this.baseUrl}/search`;
      const params: any = {
        search_terms: query,
        page,
        page_size: pageSize,
        fields:
          'code,product_name,brands,categories,image_url,ingredients_text,nutrition_grades,allergens,labels,quantity',
      };

      if (category) {
        params.categories = category;
      }

      const response = await axios.get(searchUrl, { params });

      const result = {
        products: response.data.products || [],
        count: response.data.count || 0,
        page: response.data.page || 1,
      };

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, JSON.stringify(result), 86400);

      return result;
    } catch (error) {
      console.error('Open Pet Food Facts search error:', error);
      return { products: [], count: 0, page: 1 };
    }
  }

  async getProduct(barcode: string): Promise<PetFoodProduct | null> {
    const cacheKey = `${this.cachePrefix}product:${barcode}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/product/${barcode}`,
        {
          params: {
            fields:
              'code,product_name,brands,categories,image_url,ingredients_text,nutrition_grades,allergens,labels,quantity',
          },
        },
      );

      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;

        // Cache for 7 days
        await this.cacheService.set(cacheKey, JSON.stringify(product), 604800);

        return product;
      }

      return null;
    } catch (error) {
      console.error('Open Pet Food Facts product fetch error:', error);
      return null;
    }
  }

  async searchBySpecies(species: string, type?: string): Promise<any> {
    // Get appropriate search terms for this species
    let searchTerms = this.getSearchTermsForSpecies(species);
    
    // If a specific type is provided, prepend it
    if (type) {
      searchTerms = [`${type} ${searchTerms[0]}`, ...searchTerms];
    }

    // Try searching with the first search term, fallback to others if needed
    for (const searchTerm of searchTerms) {
      const result = await this.searchProducts(searchTerm);
      if (result.products.length > 0) {
        return result;
      }
    }

    // If no products found with any term, return empty result
    return { products: [], count: 0, page: 1 };
  }

  async getCategories(): Promise<string[]> {
    const cacheKey = `${this.cachePrefix}categories`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const response = await axios.get(
        'https://world.openpetfoodfacts.org/categories.json',
      );

      const categories =
        response.data.tags?.map((tag: any) => tag.name) || [];

      // Cache for 7 days
      await this.cacheService.set(cacheKey, JSON.stringify(categories), 604800);

      return categories;
    } catch (error) {
      console.error('Open Pet Food Facts categories error:', error);
      return [];
    }
  }
}
