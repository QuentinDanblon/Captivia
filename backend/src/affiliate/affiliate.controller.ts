import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';

@ApiTags('affiliate')
@Controller('affiliate-stores')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get()
  @ApiOperation({
    summary: "Liste des magasins / liens d'affiliation",
    description:
      "Retourne les magasins adaptés par catégorie d'espèce (mammifère, reptile, oiseau, etc.). Utilisé pour l'onglet Magasin sur l'accueil et sur la fiche espèce.",
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      "Filtrer par catégorie d'espèce (mammifère, reptile, oiseau, poisson, amphibien, insecte, arachnide)",
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: "Filtrer par type d'offre (alimentation, materiel, general)",
  })
  @ApiResponse({ status: 200, description: 'Liste des magasins' })
  async getStores(
    @Query('category') category?: string,
    @Query('type') type?: string,
  ) {
    return this.affiliateService.getStores(category, type);
  }
}
