Plan d’intégration de l’API GBIF dans Captivia
(en suivant la documentation officielle : https://techdocs.gbif.org/en/openapi/v1/species)

1. Objectif & portée
Objectif : enrichir les fiches espèces de Captivia avec des données taxonomiques, des noms communs, des médias, des cartes de distribution, et la classification IUCN provenant de GBIF.
Portée :
Recherche en texte intégral et autocomplete.
Détails d’une espèce (taxonomie, synonymes, parents, métriques).
Noms communs (vernaculaire).
Médias (photos, vidéos).
Distribution (pays, régions, occurrence‑counts).
Catégorie IUCN.
Mises à jour périodiques (caching + actualisation).
2. Modèle de données (PostgreSQL + Prisma)
Table	Champ supplémentaire	Description
species	gbif_key (int)	usageKey retourné par GBIF.
gbif_nub_key (int)	Clef de l’arbre de référence (NUB).
taxon_id (string)	taxonID (ex. gbif:147345877).
vernacular_names (jsonb)	Tableau des noms communs par langue.
iucn_category (string)	Catégorie IUCN.
distributions (jsonb)	Tableau de pays/regions + occurrences.
media_urls (jsonb)	Tableau d’URLs médias (image cache).
metrics (jsonb)	numDescendants, numSynonyms, etc.
Les champs JSONB permettent de stocker la réponse complète du GBIF sans modèle de schéma trop serré.

3. Service NestJS – GbifService
@Injectable()
export class GbifService {
  private readonly BASE_URL = 'https://api.gbif.org/v1';

  constructor(private http: HttpService, private redis: RedisService) {}

  /** Recherche de noms (autocomplete & full text) */
  async search(query: string, limit = 20, offset = 0) {
    const url = `${this.BASE_URL}/species/search`;
    const params = { q: query, limit, offset };
    return this.requestWithCache(url, params);
  }

  /** Détails d’une espèce (usageKey) */
  async getUsage(usageKey: number) {
    const url = `${this.BASE_URL}/species/${usageKey}`;
    return this.requestWithCache(url);
  }

  /** Noms communs */
  async getVernacularNames(usageKey: number) {
    const url = `${this.BASE_URL}/species/${usageKey}/vernacularNames`;
    return this.requestWithCache(url);
  }

  /** Métriques (nombre d’enfants, descendants, etc.) */
  async getMetrics(usageKey: number) {
    const url = `${this.BASE_URL}/species/${usageKey}/metrics`;
    return this.requestWithCache(url);
  }

  /** Médias (photos, vidéos) */
  async getMedia(usageKey: number) {
    const url = `${this.BASE_URL}/species/${usageKey}/media`;
    return this.requestWithCache(url);
  }

  /** Catégorie IUCN */
  async getIucn(usageKey: number) {
    const url = `${this.BASE_URL}/species/${usageKey}/iucnRedListCategory`;
    return this.requestWithCache(url);
  }

  /** Distribution par pays/region */
  async getDistributions(usageKey: number) {
    const url = `${this.BASE_URL}/species/${usageKey}/distributions`;
    return this.requestWithCache(url);
  }

  /** Occurrence API – compte par pays (facettes) */
  async countOccurrencesByCountry(taxonKey: number) {
    const url = `${this.BASE_URL}/occurrence/count`;
    const params = { taxonKey, facet: 'country' };
    return this.requestWithCache(url, params);
  }

  /** Utilisation d’un cache Redis (TTL 24h) */
  private async requestWithCache(url: string, params = {}) {
    const cacheKey = this.buildCacheKey(url, params);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const response = await lastValueFrom(
        this.http.get(url, { params, headers: { 'User-Agent': 'https://votresite.com' } }),
      );
      await this.redis.set(cacheKey, JSON.stringify(response.data), 'EX', 86400);
      return response.data;
    } catch (e) {
      if (e.response?.status === 429) {
        // exponential back‑off
        await delay(2000);
        return this.requestWithCache(url, params);
      }
      throw e;
    }
  }
}
Les appels sont limités à 5 req/s (via un middleware de rate‑limit) pour respecter les recommandations de GBIF : « Frequent queries to search APIs may be rate limited… »
[29]
.
Le header User‑Agent est ajouté conformément à : « We highly recommend you set the HTTP User‑Agent to a URL or email address. »
[29]
.

4. API Gateway (NestJS) – routes publiques
Endpoint	Méthode	Description	Utilise GBIF?
/species/search	GET	Requête q, limit, offset → GBIF search 
[26]
Oui
/species/:id	GET	Fiche locale + données GBIF (usageKey)	Oui
/species/:id/vernacular	GET	Noms communs	Oui
/species/:id/iucn	GET	Catégorie IUCN	Oui
/species/:id/distributions	GET	Distribution par pays	Oui
/species/:id/media	GET	Médias (images)	Oui
/species/:id/metrics	GET	Métriques	Oui
/species/:id/occurrences/count	GET	Occurrences par pays (facettes)	Oui
5. Frontend Flutter – intégration
Recherche

Appel /species/search.
Affichage d’une liste (pagination) + bouton « Voir les détails ».
Détail d’espèce

Appel /species/:id.
Combine les données locales (habitat, besoins, etc.) avec les champs GBIF (vernacular, IUCN, distribution, media).
Carte de distribution : utilisation de countOccurrencesByCountry pour récupérer le nombre d’occurrences par pays → affichage sur flutter_map ou google_maps_flutter.
Médias

Récupération de media_urls + utilisation de l’API d’image de GBIF (image cache) : https://api.gbif.org/v1/image/cache/occurrence/{occurrenceId}/media/{md5}
[30]
.
Affichage d’une galerie avec zoom.
Noms communs

Affichage dans la section « Noms communs » (anglais, français, etc.).
IUCN

Icône couleur/texte « Vulnerable / Endangered / … » basée sur la valeur IUCN.
Synonymes & parents

Appel parents / synonyms via GbifService.
Navigation hiérarchique (famille → ordre → classe …).
6. Gestion du cache & actualisation
Étape	Action	Fréquence
1. Cache local	Redis TTL 24 h sur chaque appel GBIF	24 h
2. Actualisation périodique	Job cron (ex. 1 fois/sem) : met à jour les espèces les plus consultées (top 100)	Hebdomadaire
3. Push d’évènements	Quand un utilisateur ajoute une fiche ou modifie un champ, on synchronise le gbif_key si non renseigné	En temps réel
4. Monitoring	Alertes sur les erreurs 429, 5xx	En continu
7. Sécurité & conformité
Risque	Mitigation
Rate‑limit	Middleware de throttling + back‑off, cache
Données privées	GBIF ne nécessite pas d’authentification; aucune donnée personnelle n’est transmise
Licence	Toutes les données GBIF sont sous licence CC‑BY (ou autre) – l’application affiche le lien vers la source : https://www.gbif.org/species/{usageKey}
Audit	Log des requêtes GBIF avec timestamp, URL, status
8. Plan de déploiement (jours)
Jour	Tâche
1‑2	Initialisation du service GbifService + configuration Redis
3‑4	Création des routes API (NestJS)
5‑6	Implémentation du cache & du rate‑limit
7‑8	Intégration des appels GBIF dans le front‑end Flutter
9	Ajout de la carte de distribution & de la galerie média
10	Tests unitaires (service + routes) + tests d’intégration
11	Mise en place du job cron & monitoring
12	Déploiement (Vercel Serverless + Vercel Front‑end)
13	Validation fonctionnelle & recette
9. Vérification & test
Unitaires : GbifService avec nock pour simuler les réponses GBIF.
Intégration : Postman + CI (GitHub Actions) vérifie les points de terminaison /species/....
Charge : Simulation de 5 req/s pour vérifier le throttling.
Résilience : Test de 429 → back‑off.
10. Documentation interne
Guide d’utilisation du GbifService.
Tableau des champs species en relation avec GBIF.
FAQ : « Pourquoi les images ne s’affichent pas ? » (image cache, MD5, etc.).
11. Résumé des points clés (avec sources)
Fonction	Endpoints GBIF	Source
Recherche	/v1/species/search	
[26]
Détails	/v1/species/{usageKey}	(ligne 86‑88 dans [27])
Vernaculaire	/v1/species/{usageKey}/vernacularNames	
[27]
Métriques	/v1/species/{usageKey}/metrics	
[31]
Médias	/v1/species/{usageKey}/media	
[27]
IUCN	/v1/species/{usageKey}/iucnRedListCategory	
[27]
Distribution	/v1/species/{usageKey}/distributions	
[27]
Occurrence count	/v1/occurrence/count?taxonKey=…	(voir doc occurrence API)
Image cache	https://api.gbif.org/v1/image/cache/...	
[30]
Rate‑limit	Récupération des 429 & back‑off	
[29]
User‑Agent	Recommandation d’utiliser un UA	
[29]
Conclusion
En suivant ce plan, Captivia pourra tirer parti de la richesse taxonomique et des données d’occurrence de GBIF tout en respectant les limites d’utilisation, en assurant la performance grâce au caching, et en offrant une expérience utilisateur fluide sur mobile et web.