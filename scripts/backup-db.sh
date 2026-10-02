#!/bin/bash
#
# Backup PostgreSQL de Captivia — dump custom compressé + vérification intégrité + rotation (14 derniers).
#
# Usage   : ./scripts/backup-db.sh
# Cron    : 0 2 * * * cd /chemin/vers/captivia && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Produit : backups/captivia-YYYYMMDD-HHMMSS.dump
# Stratégie : pg_dump en format custom depuis DATABASE_URL (Neon direct).
#             Retrait des paramètres ?schema de l'URL avant pg_dump.

set -euo pipefail

# Docker peut être dans /usr/local/bin (hors PATH minimal de cron)
export PATH="$PATH:/usr/local/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"
KEEP=14
DB_NAME="captivia"
DATABASE_URL="${DATABASE_URL:-}"

mkdir -p "$BACKUP_DIR"

OUT="$BACKUP_DIR/captivia-$(date +%Y%m%d-%H%M%S).dump"
TEMP_DUMP="$OUT.tmp"

# En cas d'erreur, ne pas laisser de dump partiel
trap 'rm -f "$TEMP_DUMP" "$OUT"' ERR

echo "🗄️  Backup de la base '$DB_NAME' → $OUT"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur : DATABASE_URL non fourni." >&2
  exit 1
fi

# Retirer les paramètres ?schema (et autres) de l'URL
CLEAN_URL="${DATABASE_URL%%\?*}"

echo "🐘 pg_dump en format custom (no-owner)…"
pg_dump --format=custom --no-owner "$CLEAN_URL" > "$TEMP_DUMP"

# Vérifier l'intégrité du dump
echo "🔍 Vérification d'intégrité du dump…"
if pg_restore --list "$TEMP_DUMP" >/dev/null 2>&1; then
  echo "✅ Vérification OK"
else
  echo "❌ Erreur : dump invalide ou corrompu." >&2
  rm -f "$TEMP_DUMP"
  exit 1
fi

# Renommer vers le fichier final
mv "$TEMP_DUMP" "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "✅ Backup terminé : $OUT ($SIZE)"

# Rotation : ne conserver que les $KEEP dumps les plus récents
ls -1t "$BACKUP_DIR"/captivia-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
  echo "🧹 Suppression (rotation > $KEEP) : $old"
  rm -f "$old"
done

echo "📦 Backups conservés ($KEEP max) :"
ls -1t "$BACKUP_DIR"/captivia-*.dump 2>/dev/null | head -n "$KEEP"
