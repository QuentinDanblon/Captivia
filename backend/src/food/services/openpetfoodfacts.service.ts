import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../../cache/cache.service';
import {
  EXTERNAL_REQUEST_DEFAULTS,
  describeHttpError,
  isValidBarcode,
} from '../../external/http-safety';

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

  // Noms scientifiques -> termes de recherche (mappage des espèces/races)
  private readonly scientificNames: Record<string, string[]> = {
    'canis lupus familiaris': ['dog food', 'dog'],
    'canis familiaris': ['dog food', 'dog'],
    'felis catus': ['cat food', 'cat'],
    'oryctolagus cuniculus': ['rabbit food', 'hay', 'pellets'],
    'cavia porcellus': ['guinea pig food', 'hay', 'pellets'],
    'mesocricetus auratus': ['hamster food', 'rodent'],
    'phodopus sungorus': ['hamster food', 'rodent'],
    'phodopus campbelli': ['hamster food', 'rodent'],
    'phodopus roborovskii': ['hamster food', 'rodent'],
    'cricetulus griseus': ['hamster food', 'rodent'],
    'rattus norvegicus': ['rat food', 'rodent'],
    'mus musculus': ['mouse food', 'rodent'],
    'meriones unguiculatus': ['gerbil food', 'rodent'],
    'chinchilla lanigera': ['chinchilla food', 'rodent'],
    'octodon degus': ['degus food', 'rodent'],
    'mustela putorius furo': ['ferret food', 'meat'],
    'melopsittacus undulatus': ['parrot food', 'bird seed'],
    'nymphicus hollandicus': ['cockatiel food', 'bird'],
    'psittacus erithacus': ['parrot food', 'bird'],
    'serinus canaria': ['canary food', 'bird seed'],
    'taeniopygia guttata': ['bird seed', 'bird food'],
    'gallus gallus domesticus': ['chicken food', 'poultry'],
    'equus ferus caballus': ['horse food', 'equine'],
    'equus caballus': ['horse food', 'equine'],
    'bos taurus': ['cattle food', 'farm animal'],
    'ovis aries': ['sheep food', 'farm animal'],
    'capra aegagrus hircus': ['goat food', 'farm animal'],
    'sus scrofa domesticus': ['pig food', 'farm animal'],
    'betta splendens': ['betta food', 'fish food'],
    'carassius auratus': ['goldfish food', 'fish food'],
    'poecilia reticulata': ['guppy food', 'fish food'],
    'paracheirodon innesi': ['tetra food', 'fish food'],
    'eublepharis macularius': ['gecko food', 'insect food'],
    'pogona vitticeps': ['bearded dragon food', 'insect food'],
    'python regius': ['reptile food', 'frozen rodent'],
    'pantherophis guttatus': ['reptile food', 'frozen rodent'],
    'testudo graeca': ['tortoise food', 'reptile'],
    'testudo hermanni': ['tortoise food', 'reptile'],
    'trachemys scripta': ['turtle food', 'reptile'],
    'ambystoma mexicanum': ['amphibian food', 'insect food'],
  };

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get appropriate search terms for a species
   */
  private getSearchTermsForSpecies(species: string): string[] {
    const speciesLower = species.toLowerCase().trim();

    // 1) Match par nom scientifique exact (ex: "Canis lupus familiaris")
    const sci = this.scientificNames[speciesLower];
    if (sci) {
      return sci;
    }

    // 2) Direct match par mot-clé
    if (this.speciesSearchTerms[speciesLower]) {
      return this.speciesSearchTerms[speciesLower];
    }

    // 3) Mots-clés de races : si le nom contient une race de chien/chat
    //    connue, on cible l'espèce de base (les races n'existent pas dans OPFF).
    const breedMappings: Array<{ keywords: string[]; terms: string[] }> = [
      { keywords: ['labrador', 'golden', 'berger', 'beagle', 'caniche', 'bulldog', 'boxer', 'husky', 'dobermann', 'chihuahua', 'carlin', 'rottweiler', 'teckel', 'shih', 'bichon', 'bouledogue', 'cocker', 'dalmatien', 'dogue', 'épagneul', 'terrier', 'retriever', 'colley', 'mastiff', 'pinscher', 'schnauzer', 'shiba', 'spitz', 'yorkshire', 'canis', 'chien'], terms: ['dog food', 'dog'] },
      { keywords: ['persan', 'siamois', 'maine coon', 'bengal', 'british', 'scottish', 'sphynx', 'abyssin', 'birman', 'chartreux', 'ragdoll', 'sibérien', 'siberian', 'norvégien', 'felis', 'chat'], terms: ['cat food', 'cat'] },
      { keywords: ['bélier', 'angora', 'rex', 'géant des flandres', 'nain'], terms: ['rabbit food', 'hay', 'pellets'] },
      { keywords: ['perruche', 'calopsitte', 'perroquet', 'amazone', 'ara ', 'conure', 'inséparable', 'youyou', 'cacatoès', 'lori'], terms: ['parrot food', 'bird', 'seed mix'] },
      { keywords: ['canari', 'diamant mandarin', 'moineau', 'padda', 'bengali', 'astrild'], terms: ['canary food', 'bird seed'] },
      { keywords: ['hamster', 'gerbille', 'souris', 'rat ', 'octodon', 'chinchilla'], terms: ['rodent food', 'hamster food', 'seed mix'] },
      { keywords: ['cochon d', 'cobaye', 'guinea'], terms: ['guinea pig food', 'hay', 'pellets'] },
      { keywords: ['furet'], terms: ['ferret food', 'meat'] },
      { keywords: ['gecko', 'caméléon', 'agame', 'scinque', 'anolis'], terms: ['gecko food', 'insect food', 'crickets'] },
      { keywords: ['iguane', 'varan', 'tégou'], terms: ['reptile food', 'iguana food'] },
      { keywords: ['python', 'boa', 'serpent', 'couleuvre'], terms: ['reptile food', 'frozen rodent'] },
      { keywords: ['tortue'], terms: ['tortoise food', 'turtle food', 'reptile'] },
      { keywords: ['grenouille', 'rainette', 'dendrobate', 'axolotl', 'triton', 'crapaud'], terms: ['amphibian food', 'insect food', 'crickets'] },
      { keywords: ['guppy', 'néon', 'tétra', 'betta', 'combattant', 'poisson rouge', 'corydoras', 'scalaire', 'discus', 'gourami', 'barbus', 'danio', 'molly', 'platy', 'xipho', 'ancistrus', 'otocinclus', 'crevette'], terms: ['fish food', 'aquarium', 'flakes'] },
      { keywords: ['phasme', 'mante', 'blatte'], terms: ['insect food', 'crickets'] },
      { keywords: ['mygale', 'scorpion', 'tarentule'], terms: ['insect food', 'crickets'] },
      { keywords: ['poule', 'coq', 'poussin', 'gallus'], terms: ['chicken food', 'poultry'] },
      { keywords: ['cheval', 'poney', 'âne', 'equus'], terms: ['horse food', 'equine'] },
      { keywords: ['bovin', 'vache', 'taureau', 'veau', 'bos'], terms: ['cattle food', 'farm animal'] },
      { keywords: ['mouton', 'brebis', 'agneau', 'ovis'], terms: ['sheep food', 'farm animal'] },
      { keywords: ['chèvre', 'chevre', 'capra'], terms: ['goat food', 'farm animal'] },
      { keywords: ['porc', 'cochon', 'sus'], terms: ['pig food', 'farm animal'] },
      { keywords: ['canard'], terms: ['duck food', 'poultry'] },
      { keywords: ['pigeon'], terms: ['pigeon food', 'bird seed'] },
      { keywords: ['dindon', 'dinde'], terms: ['poultry food', 'chicken food'] },
    ];

    for (const mapping of breedMappings) {
      if (mapping.keywords.some((kw) => speciesLower.includes(kw))) {
        return mapping.terms;
      }
    }

    // 4) Partial match sur les clés génériques
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
      // NB : world.openpetfoodfacts.org/api/v2/search IGNORE search_terms
      // (renvoie toujours le catalogue complet ~15k produits -> nourriture pour
      // chat partout). L'endpoint legacy cgi/search.pl?json=1 filtre correctement.
      const params: any = {
        search_terms: query,
        json: 1,
        page,
        page_size: pageSize,
        fields:
          'code,product_name,brands,categories,image_url,ingredients_text,nutrition_grades,allergens,labels,quantity',
      };

      if (category) {
        params.tagtype_0 = 'categories';
        params.tag_contains_0 = 'contains';
        params.tag_0 = category;
      }

      const response = await axios.get(
        'https://world.openpetfoodfacts.org/cgi/search.pl',
        { params, ...EXTERNAL_REQUEST_DEFAULTS },
      );

      const result = {
        products: response.data.products || [],
        count: response.data.count || 0,
        page: response.data.page || 1,
      };

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, JSON.stringify(result), 86400);

      return result;
    } catch (error) {
      this.logger.error(`Open Pet Food Facts search error: ${describeHttpError(error)}`);
      return { products: [], count: 0, page: 1 };
    }
  }

  async getProduct(barcode: string): Promise<PetFoodProduct | null> {
    // Le barcode est interpolé dans l'URL : on n'accepte que 8 à 14 chiffres.
    if (!isValidBarcode(barcode)) {
      return null;
    }

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
          ...EXTERNAL_REQUEST_DEFAULTS,
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
      this.logger.error(`Open Pet Food Facts product fetch error: ${describeHttpError(error)}`);
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
        { ...EXTERNAL_REQUEST_DEFAULTS },
      );

      const categories =
        response.data.tags?.map((tag: any) => tag.name) || [];

      // Cache for 7 days
      await this.cacheService.set(cacheKey, JSON.stringify(categories), 604800);

      return categories;
    } catch (error) {
      this.logger.error(`Open Pet Food Facts categories error: ${describeHttpError(error)}`);
      return [];
    }
  }
}
