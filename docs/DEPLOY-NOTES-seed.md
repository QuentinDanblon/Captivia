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
