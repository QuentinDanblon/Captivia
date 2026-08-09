#!/bin/bash
#
# Restauration d'un backup PostgreSQL Captivia (dump .sql.gz).
#
# Usage   : ./scripts/restore-db.sh backups/captivia-YYYYMMDD-HHMMSS.sql.gz
#
# ⚠️ DESTRUCTIF : écrase la base 'captivia' actuelle (confirmation demandée).
# Pour une restauration propre (recommandé avant) :
#   docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
#     -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
#
# Stratégie : docker compose exec sur le service postgres si la stack tourne,
#             sinon psql local via DATABASE_URL.

set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "❌ Usage : $0 backups/captivia-*.sql.gz" >&2
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "❌ Erreur : fichier introuvable — $DUMP" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_NAME="captivia"
DATABASE_URL="${DATABASE_URL:-}"

compose() {
  docker compose --project-directory "$REPO_ROOT" "$@"
}

SIZE="$(du -h "$DUMP" | cut -f1)"
echo "⚠️  Restauration de $DUMP ($SIZE) dans la base '$DB_NAME'…"
echo "    Cette opération ÉCRASE les données actuelles."
read -r -p "    Taper 'oui' pour confirmer : " confirm
if [ "$confirm" != "oui" ]; then
  echo "Annulé."
  exit 1
fi

if [ -n "$(compose ps --status running -q postgres 2>/dev/null)" ]; then
  echo "🐳 Restauration via le service Compose postgres…"
  gunzip -c "$DUMP" | compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
elif command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
  echo "🐘 Restauration via psql local (DATABASE_URL)…"
  gunzip -c "$DUMP" | psql "$DATABASE_URL"
else
  echo "❌ Erreur : la stack Compose n'est pas démarrée et DATABASE_URL n'est pas fourni pour psql local." >&2
  exit 1
fi

echo "✅ Restauration terminée."
