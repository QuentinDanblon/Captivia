> Archivé le 2026-10-03 : contenu repris dans `docs/RUNBOOK.md` § 6.6 (idempotence du seed, nettoyage d'une base seedée avant le 2026-10-02).

# Seed Production - Notes de déploiement

## Purgé de magasins factices

Pour une base de données déjà seedée qui contient les anciens magasins factices avec URLs `example-*`, exécutez la requête SQL suivante :

```sql
DELETE FROM "AffiliateStore" WHERE url LIKE '%example-%';
```

Cette requête supprime tous les magasins d'affiliation dont l'URL contient "example-", ce qui correspond aux magasins factices qui ont été supprimés du seed.

## Idempotence du seed

Le seed production est conçu pour être exécutable plusieurs fois sans créer de doublons :
- Les données éditoriales (SpeciesProfile, SpeciesFeeding, etc.) utilise des upserts par clés naturelles
- Les magasins d'affiliation (AffiliateStore) sont upsertés par nom
- Aucun `deleteMany` n'est exécuté pour préserver les données ajoutées manuellement

Exécutez simplement :
```bash
npx prisma db seed
```

## Entrées non animales du catalogue de races (2026-10-02)

85 entrées de `breeds-data.json` (identifiants 2000000451 à 2000000533, plus 2000000608 et 2000001172) ne sont pas des animaux : outils, objets et identifiants Wikidata non résolus, importés par erreur et classés « Chat ». Elles sont listées dans `backend/prisma/enrichment/excluded-breed-ids.json` et ne sont plus importées par le seed.

Pour nettoyer une base déjà seedée, à exécuter si aucun animal d'utilisateur ne les référence :

```sql
DELETE FROM "SpeciesFeeding"       WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
DELETE FROM "SpeciesHabitat"       WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
DELETE FROM "SpeciesBehavior"      WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
DELETE FROM "SpeciesHealthContent" WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
DELETE FROM "SpeciesLegislation"   WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
DELETE FROM "SpeciesReproduction"  WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
DELETE FROM "SpeciesProfile"       WHERE "speciesId" BETWEEN 2000000451 AND 2000000533 OR "speciesId" IN (2000000608, 2000001172);
```
