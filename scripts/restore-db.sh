#!/bin/bash
#
# Restauration d'un backup PostgreSQL Captivia (dump custom .dump).
#
# Usage   : ./scripts/restore-db.sh backups/captivia-YYYYMMDD-HHMMSS.dump
#
# ⚠️ DESTRUCTIF : écrase la base 'captivia' actuelle (confirmation demandée).
# Stratégie : pg_restore sur DATABASE_URL avec --clean et --if-exists.

set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "❌ Usage : $0 backups/captivia-*.dump" >&2
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

SIZE="$(du -h "$DUMP" | cut -f1)"
echo "⚠️  Restauration de $DUMP ($SIZE) dans la base '$DB_NAME'…"
echo "    Cette opération ÉCRASE les données actuelles."
read -r -p "    Taper 'oui' pour confirmer : " confirm
if [ "$confirm" != "oui" ]; then
  echo "Annulé."
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur : DATABASE_URL non fourni." >&2
  exit 1
fi

echo "🐘 Restauration via pg_restore (--clean --if-exists --no-owner)…"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DUMP"

echo "✅ Restauration terminée."
