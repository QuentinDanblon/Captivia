-- Tâche : fiches espèces sourcées (enrichissement habitat et comportement).
-- Pourquoi : les guides consultés n'établissent pas toujours le type d'installation, les dimensions,
-- l'éclairage, l'enrichissement, le coût ou un niveau de difficulté. Les faits connus restent utiles.
-- Compatibilité N-1 : champs auparavant requis deviennent facultatifs, sans supprimer de donnée.
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "costEstimate" DROP NOT NULL;
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "habitatType" DROP NOT NULL;
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "minSpaceSize" DROP NOT NULL;
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "lightNeeds" DROP NOT NULL;
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "activityEnrichment" DROP NOT NULL;
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "tempMin" DROP NOT NULL;
ALTER TABLE "SpeciesHabitat" ALTER COLUMN "tempMax" DROP NOT NULL;
ALTER TABLE "SpeciesBehavior" ALTER COLUMN "difficultyLevel" DROP NOT NULL;
