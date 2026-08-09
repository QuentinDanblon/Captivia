#!/bin/bash
#
# Backup PostgreSQL de Captivia — dump compressé + rotation (14 derniers).
#
# Usage   : ./scripts/backup-db.sh
# Cron    : 0 2 * * * cd /chemin/vers/captivia && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Produit : backups/captivia-YYYYMMDD-HHMMSS.sql.gz
# Stratégie : docker compose exec sur le service postgres si la stack tourne,
#             sinon pg_dump local via DATABASE_URL (fallback identifiants dev).

set -euo pipefail

# Docker peut être dans /usr/local/bin (hors PATH minimal de cron)
export PATH="$PATH:/usr/local/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"
KEEP=14
DB_NAME="captivia"
DB_USER="user"
DATABASE_URL="${DATABASE_URL:-}"

compose() {
  docker compose --project-directory "$REPO_ROOT" "$@"
}

mkdir -p "$BACKUP_DIR"

OUT="$BACKUP_DIR/captivia-$(date +%Y%m%d-%H%M%S).sql.gz"

# En cas d'erreur, ne pas laisser de dump partiel
trap 'rm -f "$OUT"' ERR

echo "🗄️  Backup de la base '$DB_NAME' → $OUT"

if [ -n "$(compose ps --status running -q postgres 2>/dev/null)" ]; then
  echo "🐳 Service Compose postgres détecté — pg_dump via docker compose exec…"
  compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$OUT"
elif command -v pg_dump >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
  echo "🐘 pg_dump local détecté (DATABASE_URL)…"
  pg_dump "$DATABASE_URL" | gzip > "$OUT"
else
  echo "❌ Erreur : la stack Compose n'est pas démarrée et DATABASE_URL n'est pas fourni pour pg_dump local." >&2
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "✅ Backup terminé : $OUT ($SIZE)"

# Rotation : ne conserver que les $KEEP dumps les plus récents
ls -1t "$BACKUP_DIR"/captivia-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
  echo "🧹 Suppression (rotation > $KEEP) : $old"
  rm -f "$old"
done

echo "📦 Backups conservés ($KEEP max) :"
ls -1t "$BACKUP_DIR"/captivia-*.sql.gz 2>/dev/null | head -n "$KEEP"
