-- ROU-01 : davantage de routines personnalisées pour les animaux.
-- Expansion compatible N-1 : les quatre types historiques restent acceptés.
-- Aucune colonne supprimée ou renommée ; aucune fréquence de soin prescrite.
-- Les CHECK sont remplacés sous le même verrou, dans une transaction unique.
BEGIN;

ALTER TABLE "Routine"
  DROP CONSTRAINT "Routine_type_check",
  ADD CONSTRAINT "Routine_type_check" CHECK ("type" IN (
    'nourrissage', 'entretien', 'uvb', 'controle',
    'changement_eau', 'nettoyage_habitat', 'litiere', 'promenade',
    'exercice', 'brossage', 'hygiene', 'entrainement', 'controle_materiel'
  ));

ALTER TABLE "SpeciesRoutineTemplate"
  DROP CONSTRAINT "SpeciesRoutineTemplate_type_check",
  ADD CONSTRAINT "SpeciesRoutineTemplate_type_check" CHECK ("type" IN (
    'nourrissage', 'entretien', 'uvb', 'controle',
    'changement_eau', 'nettoyage_habitat', 'litiere', 'promenade',
    'exercice', 'brossage', 'hygiene', 'entrainement', 'controle_materiel'
  ));

COMMIT;
