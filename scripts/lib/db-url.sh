#!/bin/bash
#
# Fonctions partagées par backup-db.sh et restore-db.sh (à sourcer, pas à exécuter).
#
# Ne jamais afficher une URL de base de données : elle contient le mot de passe.

# strip_schema_param URL
#   Écrit sur stdout l'URL sans le paramètre de requête « schema=… ».
#   Prisma ajoute ?schema=public aux URL ; libpq (pg_dump, pg_restore, psql) refuse ce
#   paramètre (« invalid URI query parameter »). Tous les AUTRES paramètres sont conservés
#   (sslmode=require et channel_binding=require sont exigés par Neon).
strip_schema_param() {
  local url="$1"
  case "$url" in
    *\?*) ;;
    *)
      printf '%s' "$url"
      return 0
      ;;
  esac

  local base="${url%%\?*}"
  local rest="${url#*\?}"
  local kept="" param=""
  while [ -n "$rest" ]; do
    case "$rest" in
      *\&*)
        param="${rest%%\&*}"
        rest="${rest#*\&}"
        ;;
      *)
        param="$rest"
        rest=""
        ;;
    esac
    case "$param" in
      schema=* | "") ;;
      *) kept="${kept:+$kept&}$param" ;;
    esac
  done

  if [ -n "$kept" ]; then
    printf '%s?%s' "$base" "$kept"
  else
    printf '%s' "$base"
  fi
}

# refuse_pooled_url URL
#   Sort en erreur (sans afficher l'URL) si l'hôte est un pooler Neon (« -pooler ») :
#   pg_dump / pg_restore exigent l'URL DIRECTE (PgBouncer en mode transaction ne convient pas).
refuse_pooled_url() {
  case "$1" in
    *-pooler*)
      echo "❌ Erreur : DATABASE_URL pointe vers le pooler Neon (hôte « -pooler »). Utiliser l'URL DIRECTE (sans -pooler)." >&2
      return 1
      ;;
  esac
  return 0
}

# db_target_label URL
#   Écrit « hôte / base » (sans identifiants ni paramètres) pour permettre à l'opérateur de
#   vérifier la cible avant une opération destructive, sans jamais afficher le mot de passe.
db_target_label() {
  local rest="${1#*://}"
  local authority="${rest%%/*}"
  local host="${authority##*@}"
  host="${host%%:*}"
  local db=""
  case "$rest" in
    */*)
      db="${rest#*/}"
      db="${db%%\?*}"
      ;;
  esac
  printf '%s / %s' "$host" "${db:-?}"
}
