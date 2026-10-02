#!/bin/bash
#
# Restauration d'une sauvegarde PostgreSQL Captivia (dump au format custom, .dump).
#
# Usage   : DATABASE_URL='<URL Neon DIRECTE de la base cible>' \
#             bash scripts/restore-db.sh chemin/vers/captivia-YYYYMMDD-HHMMSS.dump
#
# Le fichier doit être DÉCHIFFRÉ au préalable (age --decrypt, voir docs/RUNBOOK.md §3).
#
# ⚠️ DESTRUCTIF : remplace les objets de la base ciblée par ceux du dump (confirmation « oui »
# demandée, la cible est affichée sans identifiants). À tester d'abord sur une branche Neon
# jetable.
#
# Stratégie : pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error.
#   - --single-transaction + --exit-on-error : tout ou rien. À la première erreur, la
#     transaction est annulée et la base reste dans son état d'origine ;
#   - le paramètre ?schema=… (Prisma) est retiré de l'URL, les autres paramètres sont conservés
#     (sslmode=require…) ;
#   - l'URL contient le mot de passe : elle n'est JAMAIS affichée ;
#   - pg_restore doit être de version >= celle du pg_dump qui a produit le dump (PostgreSQL 17
#     dans le workflow de sauvegarde), sinon « unsupported version in file header ».

set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "❌ Usage : $0 chemin/vers/captivia-YYYYMMDD-HHMMSS.dump" >&2
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "❌ Erreur : fichier introuvable — $DUMP" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/db-url.sh source-path=SCRIPTDIR
source "$SCRIPT_DIR/lib/db-url.sh"

DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur : DATABASE_URL non fourni." >&2
  exit 1
fi
refuse_pooled_url "$DATABASE_URL"

SIZE="$(du -h "$DUMP" | cut -f1)"
echo "⚠️  Restauration de $DUMP ($SIZE)"
echo "    Cible : $(db_target_label "$DATABASE_URL")"
echo "    Cette opération REMPLACE les données actuelles de cette base."
read -r -p "    Taper 'oui' pour confirmer : " confirm
if [ "$confirm" != "oui" ]; then
  echo "Annulé."
  exit 1
fi

CLEAN_URL="$(strip_schema_param "$DATABASE_URL")"

echo "🐘 Restauration via pg_restore (--clean --if-exists --no-owner --single-transaction --exit-on-error)…"
pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error \
  --dbname="$CLEAN_URL" "$DUMP"

echo "✅ Restauration terminée."
