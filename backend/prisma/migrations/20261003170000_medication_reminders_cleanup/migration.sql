-- Rappels de médicaments générés à tort (migration de DONNÉES uniquement, aucun changement de schéma).
--
-- Bug corrigé : `GradeService` créait un rappel quotidien à 08:00 (heure locale) pour TOUT
-- médicament actif, alors que l'Agenda (et les rappels locaux de l'app) n'affichent :
--  - `weekly` : qu'une prise le jour de la semaine de `startDate` ;
--  - `every_x_hours` : que la grille d'intervalles réels de N heures depuis 08:00 locale du
--    premier jour.
-- Les rappels sont désormais calculés par `src/common/care-occurrences.ts` (source unique).
--
-- Ce script supprime les `NotificationEvent` de médicament encore `pending` dont l'instant ne fait
-- pas partie des prises de leur médicament :
--  - les événements traités par l'utilisateur (`done` / `skipped`) sont CONSERVÉS (historique ;
--    un médicament ne rapporte aucun point) ;
--  - les RDV, vaccins, routines et types personnalisés ne sont pas concernés ;
--  - fuseau : `User.timezone`, repli Europe/Paris s'il est inconnu de PostgreSQL (comme le code) ;
--  - idempotent : une seconde exécution ne trouve plus rien à supprimer ; sans danger sur une
--    base vide.
-- Filet de sécurité complémentaire (code) : le scheduler n'envoie jamais un rappel de médicament
-- ou de routine qui ne correspond plus à sa source (`isStillScheduled`) et le supprime.
WITH known_tz AS MATERIALIZED (
  SELECT "name" FROM pg_timezone_names
)
DELETE FROM "NotificationEvent" AS e
USING "Medication" AS m,
      "User" AS u,
      LATERAL (
        SELECT CASE
                 WHEN u."timezone" IN (SELECT "name" FROM known_tz) THEN u."timezone"
                 ELSE 'Europe/Paris'
               END AS tz
      ) AS t
WHERE e."medicationId" = m."id"
  AND e."userId" = u."id"
  AND e."status" = 'pending'
  AND e."sourceKey" = 'medication:' || m."id"
  AND (
    -- Hebdomadaire : jour de semaine LOCAL du rappel ≠ jour de semaine de la date de début
    -- (date calendaire stockée à minuit UTC).
    (
      m."frequency" = 'weekly'
      AND EXTRACT(DOW FROM (e."scheduledAt" AT TIME ZONE t.tz))
          <> EXTRACT(DOW FROM (m."startDate" AT TIME ZONE 'UTC'))
    )
    OR
    -- Toutes les N heures : instant hors de la grille ancrée à 08:00 locale du premier jour.
    (
      m."frequency" = 'every_x_hours'
      AND m."intervalHours" > 0
      AND MOD(
            ROUND(EXTRACT(EPOCH FROM (
              e."scheduledAt"
              - (((m."startDate" AT TIME ZONE 'UTC')::date + TIME '08:00') AT TIME ZONE t.tz)
            )))::bigint,
            m."intervalHours"::bigint * 3600
          ) <> 0
    )
  );
